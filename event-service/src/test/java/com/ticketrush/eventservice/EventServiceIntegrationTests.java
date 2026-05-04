package com.ticketrush.eventservice;

import com.ticketrush.eventservice.dto.EventDTO;
import com.ticketrush.eventservice.dto.EventPriceTierDTO;
import com.ticketrush.eventservice.dto.SeatBatchDTO;
import com.ticketrush.eventservice.dto.SeatCreationRequest;
import com.ticketrush.eventservice.dto.VenueDTO;
import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.Venue;
import com.ticketrush.eventservice.entity.VenueZone;
import com.ticketrush.eventservice.repository.EventPriceTierRepository;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.SeatRepository;
import com.ticketrush.eventservice.repository.VenueRepository;
import com.ticketrush.eventservice.repository.VenueZoneRepository;
import com.ticketrush.eventservice.service.EventService;
import com.ticketrush.eventservice.service.SeatService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
class EventServiceIntegrationTests {

    @Autowired
    private EventService eventService;

    @Autowired
    private SeatService seatService;

    @Autowired
    private VenueRepository venueRepository;

    @Autowired
    private VenueZoneRepository venueZoneRepository;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private EventPriceTierRepository eventPriceTierRepository;

    @Test
    void createAndUpdateEvent_shouldPersistExpandedDomainFields() {
        Venue venue = new Venue();
        venue.setName("Riverside Hall");
        venue.setAddress("12 Main Street");
        venue.setTotalCapacity(1200);
        venue = venueRepository.save(venue);

        VenueZone vipZone = new VenueZone();
        vipZone.setVenue(venue);
        vipZone.setName("VIP");
        vipZone.setDescription("VIP Section");
        vipZone = venueZoneRepository.save(vipZone);

        EventDTO createRequest = new EventDTO();
        createRequest.setName("Neon Skyline Festival");
        createRequest.setCategory("Concert");
        createRequest.setOrganizer("Aurora Entertainment");
        createRequest.setDescription("Large-scale concert with premium experiences.");
        createRequest.setLocation("Manual fallback location");
        createRequest.setStartTime(LocalDateTime.of(2026, 7, 15, 19, 30));
        createRequest.setEndTime(LocalDateTime.of(2026, 7, 15, 23, 0));
        createRequest.setBannerUrl("https://example.com/banner.jpg");
        createRequest.setStatus("LIVE");
        createRequest.setVenue(new VenueDTO(venue.getId(), null, null, null));
        createRequest.setPriceTiers(List.of(
                new EventPriceTierDTO(null, null, vipZone.getId(), "VIP", BigDecimal.valueOf(150))
        ));

        EventDTO created = eventService.createEvent(createRequest);

        assertNotNull(created.getId());
        assertEquals("Concert", created.getCategory());
        assertEquals("Aurora Entertainment", created.getOrganizer());
        assertEquals("LIVE", created.getStatus());
        assertEquals("https://example.com/banner.jpg", created.getBannerUrl());
        assertNotNull(created.getVenue());
        assertEquals("Riverside Hall", created.getVenue().getName());
        assertEquals(1, created.getPriceTiers().size());
        assertEquals("VIP", created.getPriceTiers().get(0).getTierName());

        EventDTO updateRequest = new EventDTO();
        updateRequest.setName("Neon Skyline Festival - Final");
        updateRequest.setCategory("Concert");
        updateRequest.setOrganizer("Aurora Entertainment Group");
        updateRequest.setDescription("Updated event description.");
        updateRequest.setStartTime(LocalDateTime.of(2026, 7, 16, 20, 0));
        updateRequest.setEndTime(LocalDateTime.of(2026, 7, 16, 23, 30));
        updateRequest.setImageUrl("https://example.com/final-image.jpg");
        updateRequest.setStatus("PENDING");
        updateRequest.setVenue(new VenueDTO(venue.getId(), null, null, null));
        updateRequest.setPriceTiers(List.of(
                new EventPriceTierDTO(null, null, vipZone.getId(), "VIP Premium", BigDecimal.valueOf(175))
        ));

        EventDTO updated = eventService.updateEvent(created.getId(), updateRequest);

        assertEquals("Neon Skyline Festival - Final", updated.getName());
        assertEquals("Aurora Entertainment Group", updated.getOrganizer());
        assertEquals("PENDING", updated.getStatus());
        assertEquals("https://example.com/final-image.jpg", updated.getImageUrl());
        assertEquals("https://example.com/final-image.jpg", updated.getBannerUrl());
        assertEquals(1, updated.getPriceTiers().size());
        assertEquals("VIP Premium", updated.getPriceTiers().get(0).getTierName());
    }

    @Test
    void createSeatsForEvent_shouldRebuildSeatMatrixUsingVenueZonesAndEventPriceTiers() {
        Venue venue = new Venue();
        venue.setName("Skyline Dome");
        venue.setAddress("99 Arena Way");
        venue.setTotalCapacity(5000);
        venue = venueRepository.save(venue);

        Event event = new Event();
        event.setName("Championship Night");
        event.setVenue(venue);
        event.setLocation(venue.getAddress());
        event = eventRepository.save(event);

        SeatCreationRequest firstRequest = new SeatCreationRequest(
                event.getId(),
                List.of(new SeatBatchDTO("VIP", "VIP Zone", 200.0, 2, 3))
        );

        seatService.createSeatsForEvent(firstRequest);

        assertEquals(6, seatRepository.findByEventId(event.getId()).size());
        assertEquals(1, eventPriceTierRepository.findByEventId(event.getId()).size());
        assertEquals(1, venueZoneRepository.findByVenueId(venue.getId()).stream()
                .filter(zone -> zone.getName().equalsIgnoreCase("VIP"))
                .count());

        SeatCreationRequest secondRequest = new SeatCreationRequest(
                event.getId(),
                List.of(new SeatBatchDTO("VIP", "VIP Zone Updated", 250.0, 1, 4))
        );

        seatService.createSeatsForEvent(secondRequest);

        assertEquals(4, seatRepository.findByEventId(event.getId()).size());
        assertEquals(1, eventPriceTierRepository.findByEventId(event.getId()).size());

        List<VenueZone> zones = venueZoneRepository.findByVenueId(venue.getId());
        assertEquals(1, zones.stream().filter(zone -> zone.getName().equalsIgnoreCase("VIP")).count());
        assertTrue(zones.stream().anyMatch(zone -> "VIP Zone Updated".equals(zone.getDescription())));
    }
}
