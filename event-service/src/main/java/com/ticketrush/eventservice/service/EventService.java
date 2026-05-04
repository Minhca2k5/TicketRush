package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.dto.EventDTO;
import com.ticketrush.eventservice.dto.EventPriceTierDTO;
import com.ticketrush.eventservice.dto.EventSummaryDTO;
import com.ticketrush.eventservice.dto.PriceTierDTO;
import com.ticketrush.eventservice.dto.SeatLayoutItemDTO;
import com.ticketrush.eventservice.dto.SeatMapLayoutDTO;
import com.ticketrush.eventservice.dto.SeatRowLayoutDTO;
import com.ticketrush.eventservice.dto.SeatDTO;
import com.ticketrush.eventservice.dto.SeatZoneLayoutDTO;
import com.ticketrush.eventservice.dto.VenueDTO;
import com.ticketrush.eventservice.dto.VenueZoneDTO;
import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.EventPriceTier;
import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.entity.Venue;
import com.ticketrush.eventservice.entity.VenueZone;
import com.ticketrush.eventservice.repository.EventPriceTierRepository;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.SeatRepository;
import com.ticketrush.eventservice.repository.VenueRepository;
import com.ticketrush.eventservice.repository.VenueZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final SeatRepository seatRepository;
    private final VenueZoneRepository venueZoneRepository;
    private final VenueRepository venueRepository;
    private final EventPriceTierRepository eventPriceTierRepository;
    private final SeatService seatService;

    @Transactional
    public EventDTO createEvent(EventDTO eventDTO) {
        Event event = new Event();
        applyEventDetails(event, eventDTO);
        Event savedEvent = eventRepository.save(event);
        return mapToDTO(savedEvent);
    }

    @Transactional(readOnly = true)
    public EventDTO getEventById(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found"));
        return mapToDTO(event);
    }

    @Transactional(readOnly = true)
    public List<EventSummaryDTO> getAllEvents() {
        return eventRepository.findAll().stream()
                .map(this::mapToSummaryDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public EventDTO updateEvent(Long id, EventDTO eventDTO) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found"));
        applyEventDetails(event, eventDTO);
        Event updatedEvent = eventRepository.save(event);
        return mapToDTO(updatedEvent);
    }

    @Transactional
    public void deleteEvent(Long id) {
        if (!eventRepository.existsById(id)) {
            throw new RuntimeException("Event not found");
        }
        eventRepository.deleteById(id);
    }

    @Transactional
    public List<SeatDTO> getSeatMap(Long eventId) {
        seatService.releaseExpiredLocks(eventId);
        return seatRepository.findByEventId(eventId).stream()
                .map(this::mapSeatToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public SeatMapLayoutDTO getSeatMapLayout(Long eventId) {
        seatService.releaseExpiredLocks(eventId);
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event not found"));

        List<Seat> seats = seatRepository.findByEventId(eventId);

        List<SeatZoneLayoutDTO> zones = seats.stream()
                .filter(seat -> seat.getVenueZone() != null)
                .collect(Collectors.groupingBy(seat -> seat.getVenueZone().getId()))
                .values().stream()
                .map(this::mapZoneLayout)
                .sorted(Comparator.comparing(SeatZoneLayoutDTO::getZoneName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        int totalSeats = seats.size();
        int availableSeats = countByStatus(seats, "AVAILABLE");
        int bookedSeats = countByStatus(seats, "BOOKED", "SOLD", "UNAVAILABLE");
        int lockedSeats = countByStatus(seats, "LOCKED", "WAITING", "HELD", "RESERVED");

        return new SeatMapLayoutDTO(
                event.getId(),
                event.getName(),
                mapVenueToDTO(event.getVenue()),
                totalSeats,
                availableSeats,
                bookedSeats,
                lockedSeats,
                zones
        );
    }

    private void applyEventDetails(Event event, EventDTO dto) {
        event.setName(required(dto.getName(), "Event name is required"));
        event.setCategory(trimToNull(dto.getCategory()));
        event.setOrganizer(trimToNull(dto.getOrganizer()));
        event.setDescription(trimToNull(dto.getDescription()));
        event.setStartTime(dto.getStartTime());
        event.setEndTime(dto.getEndTime());
        event.setStatus(defaultIfBlank(dto.getStatus(), "DRAFT"));

        String resolvedImageUrl = firstNonBlank(dto.getImageUrl(), dto.getBannerUrl());
        event.setImageUrl(resolvedImageUrl);
        event.setBannerUrl(resolvedImageUrl);

        Venue venue = resolveVenue(dto.getVenue());
        event.setVenue(venue);

        String resolvedLocation = firstNonBlank(dto.getLocation(), venue != null ? venue.getAddress() : null);
        event.setLocation(resolvedLocation);

        syncPriceTiers(event, dto.getPriceTiers());
    }

    private Venue resolveVenue(VenueDTO venueDTO) {
        if (venueDTO == null || venueDTO.getId() == null) {
            return null;
        }
        return venueRepository.findById(venueDTO.getId())
                .orElseThrow(() -> new RuntimeException("Venue not found"));
    }

    private void syncPriceTiers(Event event, List<EventPriceTierDTO> tierDTOs) {
        List<EventPriceTier> currentTiers = event.getPriceTiers();
        if (currentTiers == null) {
            currentTiers = new ArrayList<>();
            event.setPriceTiers(currentTiers);
        } else {
            currentTiers.clear();
        }

        if (tierDTOs == null || tierDTOs.isEmpty()) {
            return;
        }

        for (EventPriceTierDTO tierDTO : tierDTOs) {
            if (tierDTO == null || tierDTO.getZoneId() == null || isBlank(tierDTO.getTierName()) || tierDTO.getPrice() == null) {
                continue;
            }

            VenueZone zone = venueZoneRepository.findById(tierDTO.getZoneId())
                    .orElseThrow(() -> new RuntimeException("Venue zone not found"));

            if (event.getVenue() != null
                    && zone.getVenue() != null
                    && !Objects.equals(zone.getVenue().getId(), event.getVenue().getId())) {
                throw new RuntimeException("Venue zone does not belong to the selected venue");
            }

            EventPriceTier tier = new EventPriceTier();
            tier.setEvent(event);
            tier.setZone(zone);
            tier.setTierName(tierDTO.getTierName().trim());
            tier.setPrice(normalizePrice(tierDTO.getPrice()));
            currentTiers.add(tier);
        }
    }

    private EventSummaryDTO mapToSummaryDTO(Event event) {
        EventSummaryDTO dto = new EventSummaryDTO();
        dto.setId(event.getId());
        dto.setName(event.getName());
        dto.setCategory(event.getCategory());
        dto.setOrganizer(event.getOrganizer());
        dto.setDescription(event.getDescription());
        dto.setLocation(event.getLocation());
        dto.setStartTime(event.getStartTime());
        dto.setEndTime(event.getEndTime());
        dto.setImageUrl(event.getImageUrl());
        dto.setBannerUrl(event.getBannerUrl());
        dto.setStatus(event.getStatus());
        dto.setVenue(mapVenueToDTO(event.getVenue()));
        return dto;
    }

    private EventDTO mapToDTO(Event event) {
        List<SeatDTO> seatDTOs = seatRepository.findByEventId(event.getId()).stream()
                .map(this::mapSeatToDTO)
                .collect(Collectors.toList());

        List<EventPriceTierDTO> priceTierDTOs = eventPriceTierRepository.findByEventId(event.getId()).stream()
                .map(this::mapEventPriceTierToDTO)
                .collect(Collectors.toList());

        EventDTO dto = new EventDTO();
        dto.setId(event.getId());
        dto.setName(event.getName());
        dto.setCategory(event.getCategory());
        dto.setOrganizer(event.getOrganizer());
        dto.setDescription(event.getDescription());
        dto.setLocation(event.getLocation());
        dto.setStartTime(event.getStartTime());
        dto.setEndTime(event.getEndTime());
        dto.setImageUrl(event.getImageUrl());
        dto.setBannerUrl(event.getBannerUrl());
        dto.setStatus(event.getStatus());
        dto.setVenue(mapVenueToDTO(event.getVenue()));
        dto.setPriceTiers(priceTierDTOs);
        dto.setSeats(seatDTOs);
        return dto;
    }

    private EventPriceTierDTO mapEventPriceTierToDTO(EventPriceTier tier) {
        return new EventPriceTierDTO(
                tier.getId() != null ? tier.getId().toString() : null,
                tier.getEvent() != null ? tier.getEvent().getId() : null,
                tier.getZone() != null ? tier.getZone().getId() : null,
                tier.getTierName(),
                tier.getPrice()
        );
    }

    private VenueDTO mapVenueToDTO(Venue venue) {
        if (venue == null) {
            return null;
        }
        return new VenueDTO(venue.getId(), venue.getName(), venue.getAddress(), venue.getTotalCapacity());
    }

    private SeatDTO mapSeatToDTO(Seat seat) {
        SeatDTO dto = new SeatDTO();
        dto.setId(seat.getId());
        dto.setSeatNumber(seat.getSeatNumber());
        dto.setStatus(seat.getStatus());
        dto.setLockHolder(seat.getLockHolder());
        dto.setLockExpiresAt(seat.getLockExpiresAt());

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

    private SeatZoneLayoutDTO mapZoneLayout(List<Seat> zoneSeats) {
        Seat firstSeat = zoneSeats.getFirst();
        VenueZone zone = firstSeat.getVenueZone();

        List<SeatRowLayoutDTO> rows = zoneSeats.stream()
                .collect(Collectors.groupingBy(this::resolveRowName))
                .entrySet().stream()
                .map(entry -> new SeatRowLayoutDTO(
                        entry.getKey(),
                        entry.getValue().stream()
                                .sorted(Comparator
                                        .comparing((Seat seat) -> seat.getCoordinateX(), Comparator.nullsLast(BigDecimal::compareTo))
                                        .thenComparing(Seat::getSeatNumber, String.CASE_INSENSITIVE_ORDER))
                                .map(this::mapSeatToLayoutItem)
                                .collect(Collectors.toList())
                ))
                .sorted(Comparator.comparing(SeatRowLayoutDTO::getRowName, this::compareRowNames))
                .collect(Collectors.toList());

        return new SeatZoneLayoutDTO(
                zone.getId(),
                zone.getName(),
                zone.getDescription(),
                firstSeat.getPriceTier() != null ? firstSeat.getPriceTier().getName() : zone.getName(),
                firstSeat.getPriceTier() != null && firstSeat.getPriceTier().getPrice() != null
                        ? BigDecimal.valueOf(firstSeat.getPriceTier().getPrice())
                        : null,
                zoneSeats.size(),
                rows
        );
    }

    private SeatLayoutItemDTO mapSeatToLayoutItem(Seat seat) {
        return new SeatLayoutItemDTO(
                seat.getId(),
                seat.getSeatNumber(),
                resolveRowName(seat),
                seat.getStatus(),
                seat.getLockHolder(),
                seat.getLockExpiresAt(),
                seat.getCoordinateX(),
                seat.getCoordinateY(),
                seat.getPriceTier() != null
                        ? new PriceTierDTO(
                        seat.getPriceTier().getId(),
                        seat.getPriceTier().getName(),
                        seat.getPriceTier().getPrice()
                )
                        : null
        );
    }

    private String resolveRowName(Seat seat) {
        String rowName = trimToNull(seat.getRowName());
        if (rowName != null) {
            return rowName;
        }
        String seatNumber = trimToNull(seat.getSeatNumber());
        if (seatNumber == null) {
            return "Unknown";
        }
        int splitIndex = 0;
        while (splitIndex < seatNumber.length() && !Character.isDigit(seatNumber.charAt(splitIndex))) {
            splitIndex++;
        }
        return splitIndex == 0 ? "Unknown" : seatNumber.substring(0, splitIndex);
    }

    private int compareRowNames(String left, String right) {
        if (left == null && right == null) {
            return 0;
        }
        if (left == null) {
            return 1;
        }
        if (right == null) {
            return -1;
        }
        return left.compareToIgnoreCase(right);
    }

    private int countByStatus(List<Seat> seats, String... statuses) {
        List<String> normalizedStatuses = java.util.Arrays.stream(statuses)
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(String::toUpperCase)
                .toList();

        return (int) seats.stream()
                .map(Seat::getStatus)
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(String::toUpperCase)
                .filter(normalizedStatuses::contains)
                .count();
    }

    private String required(String value, String message) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw new RuntimeException(message);
        }
        return normalized;
    }

    private String defaultIfBlank(String value, String defaultValue) {
        String normalized = trimToNull(value);
        return normalized != null ? normalized : defaultValue;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = trimToNull(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private boolean isBlank(String value) {
        return trimToNull(value) == null;
    }

    private BigDecimal normalizePrice(BigDecimal price) {
        return price.stripTrailingZeros().scale() < 0 ? price.setScale(0) : price;
    }
}
