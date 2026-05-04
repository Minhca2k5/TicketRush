package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.dto.DashboardSummaryDTO;
import com.ticketrush.eventservice.dto.EventDTO;
import com.ticketrush.eventservice.dto.EventPriceTierDTO;
import com.ticketrush.eventservice.dto.EventSummaryDTO;
import com.ticketrush.eventservice.dto.EventZoneConfigDTO;
import com.ticketrush.eventservice.dto.PriceTierDTO;
import com.ticketrush.eventservice.dto.SeatDTO;
import com.ticketrush.eventservice.dto.SeatLayoutItemDTO;
import com.ticketrush.eventservice.dto.SeatMapLayoutDTO;
import com.ticketrush.eventservice.dto.SeatRowLayoutDTO;
import com.ticketrush.eventservice.dto.SeatZoneLayoutDTO;
import com.ticketrush.eventservice.dto.VenueDTO;
import com.ticketrush.eventservice.dto.VenueZoneDTO;
import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.EventPriceTier;
import com.ticketrush.eventservice.entity.PriceTier;
import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.entity.Venue;
import com.ticketrush.eventservice.entity.VenueZone;
import com.ticketrush.eventservice.repository.EventPriceTierRepository;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.PriceTierRepository;
import com.ticketrush.eventservice.repository.SeatRepository;
import com.ticketrush.eventservice.repository.VenueRepository;
import com.ticketrush.eventservice.repository.VenueZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final SeatRepository seatRepository;
    private final VenueZoneRepository venueZoneRepository;
    private final VenueRepository venueRepository;
    private final EventPriceTierRepository eventPriceTierRepository;
    private final PriceTierRepository priceTierRepository;
    private final SeatService seatService;

    @Transactional
    public EventDTO createEvent(EventDTO eventDTO) {
        Event event = new Event();
        Event savedEvent = persistEventGraph(event, eventDTO);
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

    @Transactional(readOnly = true)
    public DashboardSummaryDTO getDashboardSummary() {
        List<Seat> seats = seatRepository.findAll();
        long soldSeats = seats.stream().filter(seat -> "SOLD".equalsIgnoreCase(seat.getStatus())).count();
        long lockedSeats = seats.stream().filter(seat -> "LOCKED".equalsIgnoreCase(seat.getStatus())).count();
        long availableSeats = seats.stream().filter(seat -> "AVAILABLE".equalsIgnoreCase(seat.getStatus())).count();
        double estimatedRevenue = seats.stream()
                .filter(seat -> "SOLD".equalsIgnoreCase(seat.getStatus()))
                .filter(seat -> seat.getPriceTier() != null && seat.getPriceTier().getPrice() != null)
                .mapToDouble(seat -> seat.getPriceTier().getPrice())
                .sum();

        DashboardSummaryDTO dto = new DashboardSummaryDTO();
        dto.setEventCount(eventRepository.count());
        dto.setSeatCount(seats.size());
        dto.setAvailableSeats(availableSeats);
        dto.setLockedSeats(lockedSeats);
        dto.setSoldSeats(soldSeats);
        dto.setEstimatedRevenue(estimatedRevenue);
        dto.setOccupancyRate(seats.isEmpty() ? 0 : (soldSeats * 100.0 / seats.size()));
        return dto;
    }

    @Transactional
    public EventDTO updateEvent(Long id, EventDTO eventDTO) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found"));

        if (hasSoldSeats(id)) {
            throw new RuntimeException("Cannot update an event after tickets have been sold");
        }

        Venue previousVenue = event.getVenue();
        Event updatedEvent = persistEventGraph(event, eventDTO);
        cleanupOrphanVenue(previousVenue, updatedEvent.getVenue());
        return mapToDTO(updatedEvent);
    }

    @Transactional
    public void deleteEvent(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found"));

        if (hasSoldSeats(id)) {
            throw new RuntimeException("Cannot delete an event with sold tickets");
        }

        Venue venue = event.getVenue();
        CleanupSnapshot cleanupSnapshot = clearEventArtifacts(event.getId());
        eventRepository.delete(event);
        cleanupDetachedZones(cleanupSnapshot.zoneIds(), Collections.emptySet());
        cleanupOrphanVenue(venue, null);
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

    private Event persistEventGraph(Event event, EventDTO dto) {
        event.setName(required(dto.getName(), "Event title is required"));
        event.setCategory(trimToNull(dto.getCategory()));
        event.setOrganizer(required(dto.getOrganizer(), "Organizer is required"));
        event.setDescription(trimToNull(dto.getDescription()));
        event.setStartTime(dto.getStartTime());
        event.setEndTime(dto.getEndTime());
        event.setStatus(resolveStatus(dto));

        String resolvedImageUrl = firstNonBlank(dto.getImageUrl(), dto.getBannerUrl());
        event.setImageUrl(resolvedImageUrl);
        event.setBannerUrl(resolvedImageUrl);

        Venue resolvedVenue = resolveVenue(dto.getVenue());
        event.setVenue(resolvedVenue);
        event.setLocation(firstNonBlank(dto.getLocation(), resolvedVenue != null ? resolvedVenue.getAddress() : null));

        Event persistedEvent = eventRepository.save(event);

        CleanupSnapshot cleanupSnapshot = clearEventArtifacts(persistedEvent.getId());
        ZoneSyncResult zoneSyncResult = syncZones(persistedEvent, dto.getZones(), dto.getPriceTiers());
        syncPriceTiers(persistedEvent, dto.getPriceTiers(), zoneSyncResult);
        rebuildSeats(persistedEvent, dto.getPriceTiers(), zoneSyncResult);
        cleanupDetachedZones(cleanupSnapshot.zoneIds(), zoneSyncResult.persistedZoneIds());

        return persistedEvent;
    }

    private Venue resolveVenue(VenueDTO venueDTO) {
        if (venueDTO == null) {
            throw new RuntimeException("Venue information is required");
        }

        String venueName = trimToNull(venueDTO.getName());
        String venueAddress = trimToNull(venueDTO.getAddress());

        if (venueDTO.getId() != null) {
            Venue venue = venueRepository.findById(venueDTO.getId())
                    .orElseThrow(() -> new RuntimeException("Venue not found"));

            if (venueAddress != null) {
                venue.setAddress(venueAddress);
            }
            if (venueName != null) {
                venue.setName(venueName);
            }
            if (venueDTO.getTotalCapacity() != null) {
                venue.setTotalCapacity(Math.max(0, venueDTO.getTotalCapacity()));
            }
            return venueRepository.save(venue);
        }

        if (venueAddress == null) {
            throw new RuntimeException("Venue address is required");
        }

        Venue venue = new Venue();
        venue.setName(defaultIfBlank(venueName, "Custom Venue"));
        venue.setAddress(venueAddress);
        venue.setTotalCapacity(Math.max(0, venueDTO.getTotalCapacity() != null ? venueDTO.getTotalCapacity() : 0));
        return venueRepository.save(venue);
    }

    private CleanupSnapshot clearEventArtifacts(Long eventId) {
        List<Seat> existingSeats = seatRepository.findByEventId(eventId);
        List<EventPriceTier> existingEventPriceTiers = eventPriceTierRepository.findByEventId(eventId);

        Set<Long> zoneIds = new LinkedHashSet<>();
        existingSeats.stream()
                .map(Seat::getVenueZone)
                .filter(Objects::nonNull)
                .map(VenueZone::getId)
                .forEach(zoneIds::add);
        existingEventPriceTiers.stream()
                .map(EventPriceTier::getZone)
                .filter(Objects::nonNull)
                .map(VenueZone::getId)
                .forEach(zoneIds::add);

        Set<Long> seatPriceTierIds = existingSeats.stream()
                .map(Seat::getPriceTier)
                .filter(Objects::nonNull)
                .map(PriceTier::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (!existingSeats.isEmpty()) {
            seatRepository.deleteAll(existingSeats);
            seatRepository.flush();
        }

        if (!existingEventPriceTiers.isEmpty()) {
            eventPriceTierRepository.deleteAll(existingEventPriceTiers);
            eventPriceTierRepository.flush();
        }

        for (Long priceTierId : seatPriceTierIds) {
            if (!seatRepository.existsByPriceTierId(priceTierId)) {
                priceTierRepository.deleteById(priceTierId);
            }
        }

        return new CleanupSnapshot(zoneIds);
    }

    private ZoneSyncResult syncZones(Event event, List<EventZoneConfigDTO> zoneDTOs, List<EventPriceTierDTO> tierDTOs) {
        if (event.getVenue() == null) {
            return ZoneSyncResult.empty();
        }

        Map<String, EventZoneConfigDTO> requestedZones = new LinkedHashMap<>();
        if (zoneDTOs != null) {
            for (EventZoneConfigDTO zoneDTO : zoneDTOs) {
                if (zoneDTO == null) {
                    continue;
                }
                String zoneName = required(zoneDTO.getName(), "Zone name is required");
                EventZoneConfigDTO normalized = new EventZoneConfigDTO(
                        zoneDTO.getId(),
                        zoneName,
                        defaultIfBlank(zoneDTO.getDescription(), zoneName + " Zone"),
                        zoneDTO.getRows(),
                        zoneDTO.getSeatsPerRow(),
                        defaultIfBlank(zoneDTO.getRowPrefix(), "A"),
                        zoneDTO.getSeatCount()
                );
                requestedZones.put(zoneName.toLowerCase(), normalized);
            }
        }

        if (tierDTOs != null) {
            for (EventPriceTierDTO tierDTO : tierDTOs) {
                if (tierDTO == null) {
                    continue;
                }

                if (tierDTO.getZoneId() != null) {
                    VenueZone existingZone = venueZoneRepository.findById(tierDTO.getZoneId())
                            .orElseThrow(() -> new RuntimeException("Venue zone not found"));

                    if (existingZone.getVenue() != null
                            && !Objects.equals(existingZone.getVenue().getId(), event.getVenue().getId())) {
                        throw new RuntimeException("Venue zone does not belong to the selected venue");
                    }

                    requestedZones.putIfAbsent(existingZone.getName().toLowerCase(), new EventZoneConfigDTO(
                            existingZone.getId(),
                            existingZone.getName(),
                            existingZone.getDescription(),
                            null,
                            null,
                            "A",
                            null
                    ));
                    continue;
                }

                String zoneName = trimToNull(tierDTO.getZoneName());
                if (zoneName != null) {
                    requestedZones.putIfAbsent(zoneName.toLowerCase(), new EventZoneConfigDTO(
                            null,
                            zoneName,
                            zoneName + " Zone",
                            null,
                            null,
                            "A",
                            null
                    ));
                }
            }
        }

        if (requestedZones.isEmpty()) {
            return ZoneSyncResult.empty();
        }

        List<VenueZone> persistedZones = new ArrayList<>();
        Map<Long, EventZoneConfigDTO> configByZoneId = new HashMap<>();
        Map<Long, VenueZone> byId = new HashMap<>();
        Map<String, VenueZone> byName = new HashMap<>();

        for (EventZoneConfigDTO requestedZone : requestedZones.values()) {
            VenueZone zone;
            if (requestedZone.getId() != null) {
                zone = venueZoneRepository.findById(requestedZone.getId())
                        .orElseThrow(() -> new RuntimeException("Venue zone not found"));
                if (zone.getVenue() != null && !Objects.equals(zone.getVenue().getId(), event.getVenue().getId())) {
                    throw new RuntimeException("Venue zone does not belong to the selected venue");
                }
            } else {
                zone = venueZoneRepository.findByVenueIdAndNameIgnoreCase(event.getVenue().getId(), requestedZone.getName())
                        .orElseGet(VenueZone::new);
            }

            zone.setVenue(event.getVenue());
            zone.setName(requestedZone.getName());
            zone.setDescription(defaultIfBlank(requestedZone.getDescription(), requestedZone.getName() + " Zone"));
            VenueZone savedZone = venueZoneRepository.save(zone);

            EventZoneConfigDTO persistedConfig = new EventZoneConfigDTO(
                    savedZone.getId(),
                    savedZone.getName(),
                    savedZone.getDescription(),
                    requestedZone.getRows(),
                    requestedZone.getSeatsPerRow(),
                    defaultIfBlank(requestedZone.getRowPrefix(), "A"),
                    requestedZone.getSeatCount()
            );

            persistedZones.add(savedZone);
            configByZoneId.put(savedZone.getId(), persistedConfig);
            byId.put(savedZone.getId(), savedZone);
            byName.put(savedZone.getName().toLowerCase(), savedZone);
        }

        return new ZoneSyncResult(persistedZones, byId, byName, configByZoneId);
    }

    private void syncPriceTiers(Event event, List<EventPriceTierDTO> tierDTOs, ZoneSyncResult zoneSyncResult) {
        if (tierDTOs == null || tierDTOs.isEmpty()) {
            return;
        }

        List<EventPriceTier> priceTiers = new ArrayList<>();
        for (EventPriceTierDTO tierDTO : tierDTOs) {
            if (tierDTO == null) {
                continue;
            }

            String tierName = required(tierDTO.getTierName(), "Tier name is required");
            if (tierDTO.getPrice() == null || tierDTO.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new RuntimeException("Tier price must be greater than 0");
            }

            VenueZone zone = resolveZoneForTier(tierDTO, zoneSyncResult);

            EventPriceTier eventPriceTier = new EventPriceTier();
            eventPriceTier.setEvent(event);
            eventPriceTier.setZone(zone);
            eventPriceTier.setTierName(tierName);
            eventPriceTier.setPrice(normalizePrice(tierDTO.getPrice()));
            priceTiers.add(eventPriceTier);
        }

        eventPriceTierRepository.saveAll(priceTiers);
    }

    private void rebuildSeats(Event event, List<EventPriceTierDTO> tierDTOs, ZoneSyncResult zoneSyncResult) {
        if (tierDTOs == null || tierDTOs.isEmpty()) {
            return;
        }

        validateSeatConfigCoverage(zoneSyncResult, tierDTOs);

        List<PriceTier> seatPriceTiers = new ArrayList<>();
        List<Seat> seats = new ArrayList<>();

        for (EventPriceTierDTO tierDTO : tierDTOs) {
            if (tierDTO == null) {
                continue;
            }

            VenueZone zone = resolveZoneForTier(tierDTO, zoneSyncResult);
            EventZoneConfigDTO zoneConfig = zoneSyncResult.configByZoneId().get(zone.getId());

            if (zoneConfig == null || zoneConfig.getRows() == null || zoneConfig.getSeatsPerRow() == null) {
                continue;
            }

            int rows = ensureRange(zoneConfig.getRows(), 1, 30, "Rows must be between 1 and 30");
            int seatsPerRow = ensureRange(zoneConfig.getSeatsPerRow(), 1, 50, "Seats per row must be between 1 and 50");
            String rowPrefix = defaultIfBlank(zoneConfig.getRowPrefix(), "A");

            PriceTier seatPriceTier = new PriceTier();
            seatPriceTier.setName(required(tierDTO.getTierName(), "Tier name is required"));
            seatPriceTier.setPrice(tierDTO.getPrice().doubleValue());
            seatPriceTier = priceTierRepository.save(seatPriceTier);
            seatPriceTiers.add(seatPriceTier);

            for (int rowIndex = 0; rowIndex < rows; rowIndex++) {
                String rowLabel = buildRowLabel(rowPrefix, rowIndex);
                for (int seatIndex = 1; seatIndex <= seatsPerRow; seatIndex++) {
                    Seat seat = new Seat();
                    seat.setEvent(event);
                    seat.setVenueZone(zone);
                    seat.setPriceTier(seatPriceTier);
                    seat.setRowName(rowLabel);
                    seat.setSeatNumber(rowLabel + seatIndex);
                    seat.setStatus("AVAILABLE");
                    seat.setLockHolder(null);
                    seat.setLockExpiresAt(null);
                    seat.setCoordinateX(BigDecimal.valueOf(seatIndex * 15.0));
                    seat.setCoordinateY(BigDecimal.valueOf((rowIndex + 1) * 15.0));
                    seats.add(seat);
                }
            }
        }

        if (!seats.isEmpty()) {
            seatRepository.saveAll(seats);
        }
    }

    private void validateSeatConfigCoverage(ZoneSyncResult zoneSyncResult, List<EventPriceTierDTO> tierDTOs) {
        Set<Long> tierZoneIds = tierDTOs.stream()
                .filter(Objects::nonNull)
                .map(tierDTO -> {
                    VenueZone zone = resolveZoneForTier(tierDTO, zoneSyncResult);
                    return zone.getId();
                })
                .collect(Collectors.toSet());

        for (Map.Entry<Long, EventZoneConfigDTO> entry : zoneSyncResult.configByZoneId().entrySet()) {
            EventZoneConfigDTO zoneConfig = entry.getValue();
            if (zoneConfig.getRows() == null && zoneConfig.getSeatsPerRow() == null) {
                continue;
            }
            if (!tierZoneIds.contains(entry.getKey())) {
                throw new RuntimeException("Each zone with a seat layout must also have a ticket tier");
            }
        }
    }

    private VenueZone resolveZoneForTier(EventPriceTierDTO tierDTO, ZoneSyncResult zoneSyncResult) {
        if (tierDTO.getZoneId() != null) {
            VenueZone zone = zoneSyncResult.byId().get(tierDTO.getZoneId());
            if (zone != null) {
                return zone;
            }
            return venueZoneRepository.findById(tierDTO.getZoneId())
                    .orElseThrow(() -> new RuntimeException("Venue zone not found"));
        }

        String zoneName = trimToNull(tierDTO.getZoneName());
        if (zoneName == null) {
            throw new RuntimeException("A ticket tier must be linked to a zone");
        }

        VenueZone zone = zoneSyncResult.byName().get(zoneName.toLowerCase());
        if (zone == null) {
            throw new RuntimeException("Venue zone not found for tier: " + tierDTO.getTierName());
        }
        return zone;
    }

    private void cleanupDetachedZones(Set<Long> previousZoneIds, Set<Long> activeZoneIds) {
        for (Long zoneId : previousZoneIds) {
            if (activeZoneIds.contains(zoneId)) {
                continue;
            }
            if (!seatRepository.existsByVenueZoneId(zoneId) && !eventPriceTierRepository.existsByZoneId(zoneId)) {
                venueZoneRepository.deleteById(zoneId);
            }
        }
    }

    private void cleanupOrphanVenue(Venue previousVenue, Venue currentVenue) {
        if (previousVenue == null) {
            return;
        }
        if (currentVenue != null && Objects.equals(previousVenue.getId(), currentVenue.getId())) {
            return;
        }
        if (eventRepository.countByVenueId(previousVenue.getId()) == 0
                && venueZoneRepository.findByVenueId(previousVenue.getId()).isEmpty()) {
            venueRepository.delete(previousVenue);
        }
    }

    private boolean hasSoldSeats(Long eventId) {
        return seatRepository.findByEventId(eventId).stream()
                .map(Seat::getStatus)
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(String::toUpperCase)
                .anyMatch(status -> List.of("SOLD", "BOOKED", "UNAVAILABLE").contains(status));
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
        List<Seat> seats = seatRepository.findByEventId(event.getId());
        List<EventPriceTier> eventPriceTiers = eventPriceTierRepository.findByEventId(event.getId());

        List<SeatDTO> seatDTOs = seats.stream()
                .map(this::mapSeatToDTO)
                .collect(Collectors.toList());

        List<EventPriceTierDTO> priceTierDTOs = eventPriceTiers.stream()
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
        dto.setZones(mapZonesToDTO(seats, eventPriceTiers));
        dto.setPriceTiers(priceTierDTOs);
        dto.setSeats(seatDTOs);
        return dto;
    }

    private List<EventZoneConfigDTO> mapZonesToDTO(List<Seat> seats, List<EventPriceTier> priceTiers) {
        Map<Long, List<Seat>> seatsByZoneId = seats.stream()
                .filter(seat -> seat.getVenueZone() != null)
                .collect(Collectors.groupingBy(seat -> seat.getVenueZone().getId()));

        Map<Long, VenueZone> zones = new LinkedHashMap<>();
        priceTiers.stream()
                .map(EventPriceTier::getZone)
                .filter(Objects::nonNull)
                .forEach(zone -> zones.put(zone.getId(), zone));
        seats.stream()
                .map(Seat::getVenueZone)
                .filter(Objects::nonNull)
                .forEach(zone -> zones.put(zone.getId(), zone));

        return zones.values().stream()
                .map(zone -> {
                    List<Seat> zoneSeats = seatsByZoneId.getOrDefault(zone.getId(), Collections.emptyList());
                    Map<String, Long> rowCounts = zoneSeats.stream()
                            .collect(Collectors.groupingBy(this::resolveRowName, LinkedHashMap::new, Collectors.counting()));
                    int rows = rowCounts.size();
                    int seatsPerRow = rowCounts.values().stream()
                            .mapToInt(Long::intValue)
                            .max()
                            .orElse(0);
                    String rowPrefix = zoneSeats.stream()
                            .map(this::resolveRowName)
                            .filter(Objects::nonNull)
                            .findFirst()
                            .map(this::inferRowPrefix)
                            .orElse("A");

                    return new EventZoneConfigDTO(
                            zone.getId(),
                            zone.getName(),
                            zone.getDescription(),
                            rows > 0 ? rows : null,
                            seatsPerRow > 0 ? seatsPerRow : null,
                            rowPrefix,
                            zoneSeats.size()
                    );
                })
                .sorted(Comparator.comparing(EventZoneConfigDTO::getName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    private EventPriceTierDTO mapEventPriceTierToDTO(EventPriceTier tier) {
        return new EventPriceTierDTO(
                tier.getId() != null ? tier.getId().toString() : null,
                tier.getEvent() != null ? tier.getEvent().getId() : null,
                tier.getZone() != null ? tier.getZone().getId() : null,
                tier.getZone() != null ? tier.getZone().getName() : null,
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
        dto.setRowName(seat.getRowName());
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

    private String inferRowPrefix(String rowLabel) {
        String normalized = trimToNull(rowLabel);
        if (normalized == null) {
            return "A";
        }
        int index = 0;
        while (index < normalized.length() && Character.isLetter(normalized.charAt(index))) {
            index++;
        }
        return index == 0 ? "A" : normalized.substring(0, index);
    }

    private String buildRowLabel(String rowPrefix, int rowIndex) {
        String normalizedPrefix = defaultIfBlank(rowPrefix, "A").toUpperCase();
        if (normalizedPrefix.length() == 1 && Character.isLetter(normalizedPrefix.charAt(0))) {
            int base = normalizedPrefix.charAt(0) - 'A';
            return toAlphabeticLabel(base + rowIndex);
        }
        return normalizedPrefix + (rowIndex + 1);
    }

    private String toAlphabeticLabel(int zeroBasedIndex) {
        int index = zeroBasedIndex;
        StringBuilder builder = new StringBuilder();
        do {
            builder.insert(0, (char) ('A' + (index % 26)));
            index = (index / 26) - 1;
        } while (index >= 0);
        return builder.toString();
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
        List<String> normalizedStatuses = Arrays.stream(statuses)
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

    private String resolveStatus(EventDTO dto) {
        String explicitStatus = trimToNull(dto.getStatus());
        if (explicitStatus != null) {
            return explicitStatus.toUpperCase();
        }
        if (dto.getStartTime() == null) {
            return "DRAFT";
        }
        LocalDateTime now = LocalDateTime.now();
        if (dto.getEndTime() != null && dto.getEndTime().isBefore(now)) {
            return "PAST";
        }
        if (!dto.getStartTime().isAfter(now)) {
            return "LIVE";
        }
        return "PENDING";
    }

    private int ensureRange(Integer value, int min, int max, String message) {
        if (value == null || value < min || value > max) {
            throw new RuntimeException(message);
        }
        return value;
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

    private BigDecimal normalizePrice(BigDecimal price) {
        return price.stripTrailingZeros().scale() < 0 ? price.setScale(0) : price;
    }

    private record CleanupSnapshot(Set<Long> zoneIds) {
    }

    private record ZoneSyncResult(
            List<VenueZone> zones,
            Map<Long, VenueZone> byId,
            Map<String, VenueZone> byName,
            Map<Long, EventZoneConfigDTO> configByZoneId
    ) {
        private static ZoneSyncResult empty() {
            return new ZoneSyncResult(List.of(), Map.of(), Map.of(), Map.of());
        }

        private Set<Long> persistedZoneIds() {
            return zones.stream().map(VenueZone::getId).collect(Collectors.toSet());
        }
    }
}
