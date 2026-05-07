package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.dto.SeatBatchDTO;
import com.ticketrush.eventservice.dto.SeatCreationRequest;
import com.ticketrush.eventservice.dto.SeatDTO;
import com.ticketrush.eventservice.dto.PriceTierDTO;
import com.ticketrush.eventservice.dto.VenueZoneDTO;
import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.EventPriceTier;
import com.ticketrush.eventservice.entity.PriceTier;
import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.entity.Venue;
import com.ticketrush.eventservice.entity.VenueZone;
import com.ticketrush.eventservice.exception.SeatConflictException;
import com.ticketrush.eventservice.repository.EventPriceTierRepository;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.PriceTierRepository;
import com.ticketrush.eventservice.repository.SeatRepository;
import com.ticketrush.eventservice.repository.VenueZoneRepository;
import jakarta.persistence.LockTimeoutException;
import jakarta.persistence.PessimisticLockException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SeatService {
    private static final int DEFAULT_HOLD_MINUTES = 10;
    private static final int MAX_HOLD_MINUTES = 30;
    private static final String SEAT_CONFLICT_MESSAGE = "Ghế này vừa có người đặt, vui lòng chọn ghế khác";

    private final EventRepository eventRepository;
    private final VenueZoneRepository venueZoneRepository;
    private final PriceTierRepository priceTierRepository;
    private final SeatRepository seatRepository;
    private final EventPriceTierRepository eventPriceTierRepository;

    @Transactional
    public void createSeatsForEvent(SeatCreationRequest request) {
        if (request == null || request.getEventId() == null) {
            throw new RuntimeException("Event id is required");
        }

        Event event = eventRepository.findById(request.getEventId())
                .orElseThrow(() -> new RuntimeException("Event not found"));

        Venue venue = event.getVenue();
        if (venue == null) {
            throw new RuntimeException("Event must be assigned to a venue before creating seats");
        }

        List<SeatBatchDTO> batches = request.getBatches();
        if (batches == null || batches.isEmpty()) {
            throw new RuntimeException("At least one seat batch is required");
        }

        // Rebuild the event seat matrix from scratch to keep zone/tier/seat data consistent.
        List<Seat> existingSeats = seatRepository.findByEventId(event.getId());
        List<PriceTier> existingSeatPriceTiers = existingSeats.stream()
                .map(Seat::getPriceTier)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        seatRepository.deleteAll(existingSeats);
        seatRepository.flush();

        eventPriceTierRepository.deleteAll(eventPriceTierRepository.findByEventId(event.getId()));
        eventPriceTierRepository.flush();

        priceTierRepository.deleteAll(existingSeatPriceTiers);
        priceTierRepository.flush();

        List<Seat> seatsToSave = new ArrayList<>();

        for (SeatBatchDTO batch : batches) {
            String zoneName = required(batch.getZoneName(), "Zone name is required");
            int rows = clamp(batch.getRows(), 1, 30, "Rows must be between 1 and 30");
            int seatsPerRow = clamp(batch.getSeatsPerRow(), 1, 50, "Seats per row must be between 1 and 50");
            double price = requiredPrice(batch.getPrice());

            VenueZone zone = venueZoneRepository.findByVenueIdAndNameIgnoreCase(venue.getId(), zoneName)
                    .orElseGet(() -> {
                        VenueZone created = new VenueZone();
                        created.setVenue(venue);
                        created.setName(zoneName);
                        created.setDescription(defaultDescription(batch.getZoneDescription(), zoneName));
                        return venueZoneRepository.save(created);
                    });

            zone.setDescription(defaultDescription(batch.getZoneDescription(), zoneName));
            zone = venueZoneRepository.save(zone);

            PriceTier seatPriceTier = new PriceTier();
            seatPriceTier.setName(zoneName);
            seatPriceTier.setPrice(price);
            seatPriceTier = priceTierRepository.save(seatPriceTier);

            EventPriceTier eventPriceTier = new EventPriceTier();
            eventPriceTier.setEvent(event);
            eventPriceTier.setZone(zone);
            eventPriceTier.setTierName(zoneName);
            eventPriceTier.setPrice(BigDecimal.valueOf(price));
            eventPriceTierRepository.save(eventPriceTier);

            for (int rowIndex = 0; rowIndex < rows; rowIndex++) {
                char rowChar = (char) ('A' + rowIndex);
                for (int seatNumber = 1; seatNumber <= seatsPerRow; seatNumber++) {
                    Seat seat = new Seat();
                    seat.setSeatNumber("" + rowChar + seatNumber);
                    seat.setRowName(String.valueOf(rowChar));
                    seat.setStatus("AVAILABLE");
                    seat.setLockHolder(null);
                    seat.setLockExpiresAt(null);
                    seat.setEvent(event);
                    seat.setVenueZone(zone);
                    seat.setPriceTier(seatPriceTier);
                    seat.setCoordinateX(BigDecimal.valueOf(seatNumber * 15.0));
                    seat.setCoordinateY(BigDecimal.valueOf((rowIndex + 1) * 15.0));
                    seatsToSave.add(seat);
                }
            }
        }

        seatRepository.saveAll(seatsToSave);
    }

    @Transactional
    public SeatDTO lockSeat(Long eventId, Long seatId, String holderId, Integer holdMinutes) {
        Seat seat = getSeatForEventForUpdate(eventId, seatId);
        expireLockIfNeeded(seat);

        if (isSold(seat)) {
            throw new SeatConflictException(SEAT_CONFLICT_MESSAGE);
        }

        String normalizedHolderId = required(holderId, "Holder id is required");
        if (isLockedByAnotherHolder(seat, normalizedHolderId)) {
            throw new SeatConflictException(SEAT_CONFLICT_MESSAGE);
        }

        seat.setStatus("LOCKED");
        seat.setLockHolder(normalizedHolderId);
        seat.setLockExpiresAt(LocalDateTime.now().plusMinutes(resolveHoldMinutes(holdMinutes)));
        return mapSeatToDTO(seatRepository.save(seat));
    }

    @Transactional
    public SeatDTO releaseSeat(Long eventId, Long seatId, String holderId) {
        Seat seat = getSeatForEventForUpdate(eventId, seatId);
        expireLockIfNeeded(seat);

        if (!"LOCKED".equalsIgnoreCase(seat.getStatus())) {
            return mapSeatToDTO(seat);
        }

        String normalizedHolderId = required(holderId, "Holder id is required");
        if (seat.getLockHolder() != null && !seat.getLockHolder().equals(normalizedHolderId)) {
            throw new SeatConflictException(SEAT_CONFLICT_MESSAGE);
        }

        releaseLock(seat);
        return mapSeatToDTO(seatRepository.save(seat));
    }

    @Transactional
    public List<SeatDTO> purchaseSeats(Long eventId, List<Long> seatIds, String holderId) {
        String normalizedHolderId = required(holderId, "Holder id is required");
        if (seatIds == null || seatIds.isEmpty()) {
            throw new RuntimeException("At least one seat id is required");
        }

        List<Seat> seats = new ArrayList<>();
        List<Long> sortedSeatIds = seatIds.stream().sorted().collect(Collectors.toList());
        for (Long seatId : sortedSeatIds) {
            Seat seat = getSeatForEventForUpdate(eventId, seatId);
            expireLockIfNeeded(seat);

            if (!"LOCKED".equalsIgnoreCase(seat.getStatus())) {
                throw new SeatConflictException(SEAT_CONFLICT_MESSAGE);
            }

            if (!Objects.equals(seat.getLockHolder(), normalizedHolderId)) {
                throw new SeatConflictException(SEAT_CONFLICT_MESSAGE);
            }

            if (seat.getLockExpiresAt() == null || !seat.getLockExpiresAt().isAfter(LocalDateTime.now())) {
                throw new SeatConflictException(SEAT_CONFLICT_MESSAGE);
            }

            seat.setStatus("SOLD");
            seat.setLockHolder(null);
            seat.setLockExpiresAt(null);
            seats.add(seat);
        }

        return seatRepository.saveAll(seats).stream()
                .map(this::mapSeatToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public void releaseExpiredLocks(Long eventId) {
        List<Seat> expiredSeats = seatRepository.findByEventIdAndStatusAndLockExpiresAtBefore(
                eventId,
                "LOCKED",
                LocalDateTime.now()
        );

        if (expiredSeats.isEmpty()) {
            return;
        }

        expiredSeats.forEach(this::releaseLock);
        seatRepository.saveAll(expiredSeats);
    }



    private Seat getSeatForEventForUpdate(Long eventId, Long seatId) {
        try {
            return seatRepository.findByIdAndEventIdForUpdate(seatId, eventId)
                    .orElseThrow(() -> new RuntimeException("Seat not found"));
        } catch (PessimisticLockingFailureException | LockTimeoutException | PessimisticLockException ex) {
            throw new SeatConflictException(SEAT_CONFLICT_MESSAGE, ex);
        }
    }

    private boolean isSold(Seat seat) {
        String status = seat.getStatus() == null ? "" : seat.getStatus().trim().toUpperCase();
        return List.of("SOLD", "BOOKED", "UNAVAILABLE").contains(status);
    }

    private boolean isLockedByAnotherHolder(Seat seat, String holderId) {
        return "LOCKED".equalsIgnoreCase(seat.getStatus())
                && seat.getLockHolder() != null
                && !Objects.equals(seat.getLockHolder(), holderId)
                && seat.getLockExpiresAt() != null
                && seat.getLockExpiresAt().isAfter(LocalDateTime.now());
    }

    private void expireLockIfNeeded(Seat seat) {
        if ("LOCKED".equalsIgnoreCase(seat.getStatus())
                && seat.getLockExpiresAt() != null
                && seat.getLockExpiresAt().isBefore(LocalDateTime.now())) {
            releaseLock(seat);
        }
    }

    private void releaseLock(Seat seat) {
        seat.setStatus("AVAILABLE");
        seat.setLockHolder(null);
        seat.setLockExpiresAt(null);
    }

    private int resolveHoldMinutes(Integer holdMinutes) {
        if (holdMinutes == null) {
            return DEFAULT_HOLD_MINUTES;
        }
        if (holdMinutes < 1 || holdMinutes > MAX_HOLD_MINUTES) {
            throw new RuntimeException("Hold minutes must be between 1 and 30");
        }
        return holdMinutes;
    }

    private SeatDTO mapSeatToDTO(Seat seat) {
        SeatDTO dto = new SeatDTO();
        dto.setId(seat.getId());
        dto.setSeatNumber(seat.getSeatNumber());
        dto.setRowName(seat.getRowName());
        dto.setStatus(seat.getStatus());
        dto.setLockHolder(seat.getLockHolder());
        dto.setLockExpiresAt(seat.getLockExpiresAt());
        dto.setPosX(seat.getCoordinateX());
        dto.setPosY(seat.getCoordinateY());
        dto.setRotation(java.math.BigDecimal.ZERO);

        if (seat.getVenueZone() != null) {
            VenueZoneDTO zoneDTO = new VenueZoneDTO();
            zoneDTO.setId(seat.getVenueZone().getId());
            zoneDTO.setVenueId(seat.getVenueZone().getVenue() != null ? seat.getVenueZone().getVenue().getId() : null);
            zoneDTO.setName(seat.getVenueZone().getName());
            zoneDTO.setDescription(seat.getVenueZone().getDescription());
            zoneDTO.setSeatCount(seat.getVenueZone().getSeats() != null ? seat.getVenueZone().getSeats().size() : null);
            dto.setVenueZone(zoneDTO);
        }

        if (seat.getPriceTier() != null) {
            PriceTierDTO priceTierDTO = new PriceTierDTO();
            priceTierDTO.setId(seat.getPriceTier().getId());
            priceTierDTO.setName(seat.getPriceTier().getName());
            priceTierDTO.setPrice(seat.getPriceTier().getPrice());
            dto.setPriceTier(priceTierDTO);
        }

        return dto;
    }

    private String required(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new RuntimeException(message);
        }
        return value.trim();
    }

    private double requiredPrice(Double value) {
        if (value == null || value <= 0) {
            throw new RuntimeException("Seat batch price must be greater than 0");
        }
        return value;
    }

    private String defaultDescription(String description, String zoneName) {
        if (description == null || description.trim().isEmpty()) {
            return zoneName + " Zone";
        }
        return description.trim();
    }

    private int clamp(Integer value, int min, int max, String message) {
        if (value == null || value < min || value > max) {
            throw new RuntimeException(message);
        }
        return value;
    }
}
