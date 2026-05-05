package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.EventServiceApplication;
import com.ticketrush.eventservice.dto.EventDTO;
import com.ticketrush.eventservice.dto.EventPriceTierDTO;
import com.ticketrush.eventservice.dto.EventZoneConfigDTO;
import com.ticketrush.eventservice.dto.DashboardDemographicsDTO;
import com.ticketrush.eventservice.dto.DashboardOccupancyDTO;
import com.ticketrush.eventservice.dto.DashboardRevenueDTO;
import com.ticketrush.eventservice.dto.SeatMapLayoutDTO;
import com.ticketrush.eventservice.dto.SeatBatchDTO;
import com.ticketrush.eventservice.dto.SeatCreationRequest;
import com.ticketrush.eventservice.dto.VenueDTO;
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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = EventServiceApplication.class)
@Transactional
class EventDomainIntegrationTests {

    @Autowired
    private EventService eventService;

    @Autowired
    private SeatService seatService;

    @Autowired
    private DashboardService dashboardService;

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

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void createEventStoresExpandedDomainFieldsAndPriceTiers() {
        Venue venue = createVenue("Madison Square Garden", "New York, NY", 22000);
        VenueZone vipZone = createZone(venue, "VIP", "Front section");
        VenueZone generalZone = createZone(venue, "General", "Main floor");

        EventDTO created = eventService.createEvent(new EventDTO(
                null,
                "Summer Music Festival 2024",
                "Concert",
                "Aurora Entertainment",
                "A full-day outdoor music festival.",
                null,
                LocalDateTime.of(2026, 7, 15, 18, 0),
                LocalDateTime.of(2026, 7, 15, 23, 0),
                "https://cdn.ticketrush.test/events/summer-festival.jpg",
                null,
                "LIVE",
                new VenueDTO(venue.getId(), null, null, null),
                List.of(
                        new EventPriceTierDTO(null, null, vipZone.getId(), "VIP", BigDecimal.valueOf(250)),
                        new EventPriceTierDTO(null, null, generalZone.getId(), "General Admission", BigDecimal.valueOf(99))
                ),
                null
        ));

        assertThat(created.getId()).isNotNull();
        assertThat(created.getCategory()).isEqualTo("Concert");
        assertThat(created.getOrganizer()).isEqualTo("Aurora Entertainment");
        assertThat(created.getEndTime()).isEqualTo(LocalDateTime.of(2026, 7, 15, 23, 0));
        assertThat(created.getBannerUrl()).isEqualTo("https://cdn.ticketrush.test/events/summer-festival.jpg");
        assertThat(created.getImageUrl()).isEqualTo("https://cdn.ticketrush.test/events/summer-festival.jpg");
        assertThat(created.getStatus()).isEqualTo("LIVE");
        assertThat(created.getVenue()).isNotNull();
        assertThat(created.getVenue().getId()).isEqualTo(venue.getId());
        assertThat(created.getLocation()).isEqualTo("New York, NY");
        assertThat(created.getPriceTiers())
                .extracting(EventPriceTierDTO::getTierName)
                .containsExactlyInAnyOrder("VIP", "General Admission");
    }

    @Test
    void updateEventReplacesEditableFieldsAndPriceTiers() {
        Venue primaryVenue = createVenue("Madison Square Garden", "New York, NY", 22000);
        Venue alternateVenue = createVenue("United Center", "Chicago, IL", 18000);
        VenueZone primaryZone = createZone(primaryVenue, "VIP", "Front row");
        VenueZone alternateZone = createZone(alternateVenue, "Balcony", "Upper bowl");

        EventDTO created = eventService.createEvent(new EventDTO(
                null,
                "Original Event",
                "Concert",
                "Original Organizer",
                "Original description",
                "Manual location",
                LocalDateTime.of(2026, 8, 1, 19, 0),
                LocalDateTime.of(2026, 8, 1, 22, 0),
                "https://cdn.ticketrush.test/events/original.jpg",
                null,
                "DRAFT",
                new VenueDTO(primaryVenue.getId(), null, null, null),
                List.of(new EventPriceTierDTO(null, null, primaryZone.getId(), "VIP", BigDecimal.valueOf(180))),
                null
        ));

        EventDTO updated = eventService.updateEvent(created.getId(), new EventDTO(
                created.getId(),
                "Updated Event",
                "Sports",
                "Updated Organizer",
                "Updated description",
                null,
                LocalDateTime.of(2026, 8, 10, 20, 0),
                LocalDateTime.of(2026, 8, 10, 23, 30),
                null,
                "https://cdn.ticketrush.test/events/updated-banner.jpg",
                "PENDING",
                new VenueDTO(alternateVenue.getId(), null, null, null),
                List.of(new EventPriceTierDTO(null, null, alternateZone.getId(), "Balcony", BigDecimal.valueOf(120))),
                null
        ));

        assertThat(updated.getName()).isEqualTo("Updated Event");
        assertThat(updated.getCategory()).isEqualTo("Sports");
        assertThat(updated.getOrganizer()).isEqualTo("Updated Organizer");
        assertThat(updated.getVenue().getId()).isEqualTo(alternateVenue.getId());
        assertThat(updated.getLocation()).isEqualTo("Chicago, IL");
        assertThat(updated.getBannerUrl()).isEqualTo("https://cdn.ticketrush.test/events/updated-banner.jpg");
        assertThat(updated.getImageUrl()).isEqualTo("https://cdn.ticketrush.test/events/updated-banner.jpg");
        assertThat(updated.getStatus()).isEqualTo("PENDING");
        assertThat(updated.getPriceTiers()).hasSize(1);
        assertThat(updated.getPriceTiers().get(0).getZoneId()).isEqualTo(alternateZone.getId());
        assertThat(updated.getPriceTiers().get(0).getTierName()).isEqualTo("Balcony");

        List<EventPriceTier> persistedTiers = eventPriceTierRepository.findByEventId(created.getId());
        assertThat(persistedTiers).hasSize(1);
        assertThat(persistedTiers.get(0).getZone().getId()).isEqualTo(alternateZone.getId());
    }

    @Test
    void createSeatsForEventRebuildsSeatMatrixAndEventTiers() {
        Venue venue = createVenue("Grand Arena", "Los Angeles, CA", 15000);
        Event event = createEventEntity("Arena Night", venue);

        seatService.createSeatsForEvent(new SeatCreationRequest(
                event.getId(),
                List.of(
                        new SeatBatchDTO("VIP", "Front section", 250.0, 2, 3),
                        new SeatBatchDTO("General", "Floor", 100.0, 1, 4)
                )
        ));

        List<Seat> firstBuildSeats = seatRepository.findByEventId(event.getId());
        assertThat(firstBuildSeats).hasSize(10);
        assertThat(firstBuildSeats)
                .extracting(Seat::getStatus)
                .containsOnly("AVAILABLE");
        assertThat(eventPriceTierRepository.findByEventId(event.getId())).hasSize(2);

        seatService.createSeatsForEvent(new SeatCreationRequest(
                event.getId(),
                List.of(
                        new SeatBatchDTO("VIP", "Front section", 275.0, 1, 2)
                )
        ));

        List<Seat> rebuiltSeats = seatRepository.findByEventId(event.getId());
        assertThat(rebuiltSeats).hasSize(2);
        assertThat(rebuiltSeats)
                .extracting(Seat::getSeatNumber)
                .containsExactlyInAnyOrder("A1", "A2");
        assertThat(rebuiltSeats)
                .extracting(seat -> seat.getPriceTier().getPrice())
                .containsOnly(275.0);
        assertThat(eventPriceTierRepository.findByEventId(event.getId())).hasSize(1);
    }

    @Test
    void getSeatMapLayoutGroupsSeatsByZoneAndRow() {
        Venue venue = createVenue("Riverside Arena", "Austin, TX", 9000);
        Event event = createEventEntity("Grouped Layout Event", venue);

        seatService.createSeatsForEvent(new SeatCreationRequest(
                event.getId(),
                List.of(
                        new SeatBatchDTO("VIP", "Front section", 300.0, 2, 2),
                        new SeatBatchDTO("General", "Main floor", 120.0, 1, 3)
                )
        ));

        List<Seat> seats = seatRepository.findByEventId(event.getId());
        seats.stream()
                .filter(seat -> "A1".equals(seat.getSeatNumber()) && "VIP".equals(seat.getVenueZone().getName()))
                .findFirst()
                .ifPresent(seat -> seat.setStatus("LOCKED"));
        seats.stream()
                .filter(seat -> "A2".equals(seat.getSeatNumber()) && "General".equals(seat.getVenueZone().getName()))
                .findFirst()
                .ifPresent(seat -> seat.setStatus("BOOKED"));
        seatRepository.saveAll(seats);

        SeatMapLayoutDTO layout = eventService.getSeatMapLayout(event.getId());

        assertThat(layout.getEventId()).isEqualTo(event.getId());
        assertThat(layout.getEventName()).isEqualTo("Grouped Layout Event");
        assertThat(layout.getVenue()).isNotNull();
        assertThat(layout.getVenue().getId()).isEqualTo(venue.getId());
        assertThat(layout.getTotalSeats()).isEqualTo(7);
        assertThat(layout.getAvailableSeats()).isEqualTo(5);
        assertThat(layout.getLockedSeats()).isEqualTo(1);
        assertThat(layout.getBookedSeats()).isEqualTo(1);
        assertThat(layout.getZones()).hasSize(2);

        assertThat(layout.getZones())
                .extracting(zone -> zone.getZoneName() + ":" + zone.getSeatCount())
                .containsExactly("General:3", "VIP:4");

        assertThat(layout.getZones().stream()
                .filter(zone -> "VIP".equals(zone.getZoneName()))
                .findFirst()
                .orElseThrow()
                .getRows())
                .extracting(row -> row.getRowName() + ":" + row.getSeats().size())
                .containsExactly("A:2", "B:2");
    }

    @Test
    void lockReleaseAndExpiryFlowUpdatesSeatStatusForPolling() {
        Venue venue = createVenue("Pulse Center", "Seattle, WA", 8000);
        Event event = createEventEntity("Realtime Lock Event", venue);

        seatService.createSeatsForEvent(new SeatCreationRequest(
                event.getId(),
                List.of(new SeatBatchDTO("VIP", "Front", 350.0, 1, 2))
        ));

        Seat seat = seatRepository.findByEventId(event.getId()).stream()
                .filter(item -> "A1".equals(item.getSeatNumber()))
                .findFirst()
                .orElseThrow();

        seatService.lockSeat(event.getId(), seat.getId(), "session-a", 10);

        Seat lockedSeat = seatRepository.findById(seat.getId()).orElseThrow();
        assertThat(lockedSeat.getStatus()).isEqualTo("LOCKED");
        assertThat(lockedSeat.getLockHolder()).isEqualTo("session-a");
        assertThat(lockedSeat.getLockExpiresAt()).isAfter(LocalDateTime.now());

        assertThatThrownBy(() -> seatService.lockSeat(event.getId(), seat.getId(), "session-b", 10))
                .hasMessageContaining("Ghế này vừa có người đặt");

        seatService.releaseSeat(event.getId(), seat.getId(), "session-a");

        Seat releasedSeat = seatRepository.findById(seat.getId()).orElseThrow();
        assertThat(releasedSeat.getStatus()).isEqualTo("AVAILABLE");
        assertThat(releasedSeat.getLockHolder()).isNull();
        assertThat(releasedSeat.getLockExpiresAt()).isNull();

        seatService.lockSeat(event.getId(), seat.getId(), "session-a", 1);
        Seat expiredSeat = seatRepository.findById(seat.getId()).orElseThrow();
        expiredSeat.setLockExpiresAt(LocalDateTime.now().minusMinutes(1));
        seatRepository.save(expiredSeat);

        SeatMapLayoutDTO layoutAfterExpiry = eventService.getSeatMapLayout(event.getId());
        assertThat(layoutAfterExpiry.getAvailableSeats()).isEqualTo(2);
        assertThat(layoutAfterExpiry.getLockedSeats()).isZero();

        Seat refreshedSeat = seatRepository.findById(seat.getId()).orElseThrow();
        assertThat(refreshedSeat.getStatus()).isEqualTo("AVAILABLE");
        assertThat(refreshedSeat.getLockHolder()).isNull();
    }

    @Test
    void purchaseSeatsConvertsLockedSeatsToSold() {
        Venue venue = createVenue("Checkout Arena", "Denver, CO", 12000);
        Event event = createEventEntity("Purchase Event", venue);

        seatService.createSeatsForEvent(new SeatCreationRequest(
                event.getId(),
                List.of(new SeatBatchDTO("VIP", "Front", 400.0, 1, 3))
        ));

        List<Seat> seats = seatRepository.findByEventId(event.getId());
        Seat firstSeat = seats.stream()
                .filter(item -> "A1".equals(item.getSeatNumber()))
                .findFirst()
                .orElseThrow();
        Seat secondSeat = seats.stream()
                .filter(item -> "A2".equals(item.getSeatNumber()))
                .findFirst()
                .orElseThrow();

        seatService.lockSeat(event.getId(), firstSeat.getId(), "checkout-session", 10);
        seatService.lockSeat(event.getId(), secondSeat.getId(), "checkout-session", 10);

        var purchasedSeats = seatService.purchaseSeats(
                event.getId(),
                List.of(firstSeat.getId(), secondSeat.getId()),
                "checkout-session"
        );

        assertThat(purchasedSeats).hasSize(2);
        assertThat(purchasedSeats)
                .extracting(seat -> seat.getStatus())
                .containsOnly("SOLD");

        List<Seat> persistedSeats = seatRepository.findByEventId(event.getId());
        assertThat(persistedSeats.stream()
                .filter(item -> List.of("A1", "A2").contains(item.getSeatNumber()))
                .map(Seat::getStatus))
                .containsOnly("SOLD");
        assertThat(persistedSeats.stream()
                .filter(item -> List.of("A1", "A2").contains(item.getSeatNumber()))
                .allMatch(item -> item.getLockHolder() == null && item.getLockExpiresAt() == null))
                .isTrue();

        SeatMapLayoutDTO layout = eventService.getSeatMapLayout(event.getId());
        assertThat(layout.getBookedSeats()).isEqualTo(2);
        assertThat(layout.getLockedSeats()).isZero();
        assertThat(layout.getAvailableSeats()).isEqualTo(1);
    }

    @Test
    void createEventWithInlineVenueZonesBuildsSeatsAtomically() {
        EventDTO request = new EventDTO(
                null,
                "Inline Config Event",
                "Concert",
                "TicketRush",
                "Create event with modal-driven zones and tiers.",
                null,
                LocalDateTime.of(2026, 10, 12, 19, 0),
                LocalDateTime.of(2026, 10, 12, 22, 0),
                "https://cdn.ticketrush.test/events/inline-event.jpg",
                null,
                null,
                new VenueDTO(null, "Harbor Stage", "Pier 7, Seattle, WA", 0),
                List.of(
                        new EventPriceTierDTO(null, null, null, "VIP", "VIP Access", BigDecimal.valueOf(220)),
                        new EventPriceTierDTO(null, null, null, "General", "General Admission", BigDecimal.valueOf(95))
                ),
                null
        );

        request.setZones(List.of(
                new EventZoneConfigDTO(null, "VIP", "Front section", 2, 3, "A", null),
                new EventZoneConfigDTO(null, "General", "Main floor", 1, 4, "C", null)
        ));

        EventDTO persisted = eventService.createEvent(request);

        assertThat(persisted.getVenue()).isNotNull();
        assertThat(persisted.getVenue().getName()).isEqualTo("Harbor Stage");
        assertThat(persisted.getZones()).hasSize(2);
        assertThat(seatRepository.findByEventId(persisted.getId())).hasSize(10);
        assertThat(seatRepository.findByEventId(persisted.getId()))
                .extracting(Seat::getSeatNumber)
                .containsExactlyInAnyOrder("A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3", "C4");
    }

    @Test
    void deleteEventFailsWhenSoldSeatsExist() {
        Venue venue = createVenue("Delete Guard Arena", "Boston, MA", 9500);
        Event event = createEventEntity("Protected Event", venue);

        seatService.createSeatsForEvent(new SeatCreationRequest(
                event.getId(),
                List.of(new SeatBatchDTO("VIP", "Front", 260.0, 1, 2))
        ));

        Seat soldSeat = seatRepository.findByEventId(event.getId()).stream()
                .filter(item -> "A1".equals(item.getSeatNumber()))
                .findFirst()
                .orElseThrow();

        seatService.lockSeat(event.getId(), soldSeat.getId(), "buyer-1", 10);
        seatService.purchaseSeats(event.getId(), List.of(soldSeat.getId()), "buyer-1");

        assertThatThrownBy(() -> eventService.deleteEvent(event.getId()))
                .hasMessageContaining("sold tickets");

        assertThat(eventRepository.findById(event.getId())).isPresent();
    }

    @Test
    void dashboardRevenueAndOccupancyReflectLiveSeatInventory() {
        Venue revenueVenue = createVenue("Revenue Arena", "Phoenix, AZ", 10000);
        Event revenueEvent = createEventEntity("Revenue Event", revenueVenue);

        seatService.createSeatsForEvent(new SeatCreationRequest(
                revenueEvent.getId(),
                List.of(new SeatBatchDTO("VIP", "Front row", 125.0, 1, 3))
        ));

        List<Seat> revenueSeats = seatRepository.findByEventId(revenueEvent.getId());
        Seat soldA1 = revenueSeats.stream().filter(seat -> "A1".equals(seat.getSeatNumber())).findFirst().orElseThrow();
        Seat soldA2 = revenueSeats.stream().filter(seat -> "A2".equals(seat.getSeatNumber())).findFirst().orElseThrow();

        seatService.lockSeat(revenueEvent.getId(), soldA1.getId(), "buyer-a", 10);
        seatService.lockSeat(revenueEvent.getId(), soldA2.getId(), "buyer-a", 10);
        seatService.purchaseSeats(revenueEvent.getId(), List.of(soldA1.getId(), soldA2.getId()), "buyer-a");

        Venue occupancyVenue = createVenue("Occupancy Center", "Portland, OR", 7000);
        Event occupancyEvent = createEventEntity("Occupancy Event", occupancyVenue);

        seatService.createSeatsForEvent(new SeatCreationRequest(
                occupancyEvent.getId(),
                List.of(new SeatBatchDTO("General", "Main floor", 75.0, 1, 2))
        ));

        Seat lockedSeat = seatRepository.findByEventId(occupancyEvent.getId()).stream()
                .filter(seat -> "A1".equals(seat.getSeatNumber()))
                .findFirst()
                .orElseThrow();
        seatService.lockSeat(occupancyEvent.getId(), lockedSeat.getId(), "viewer-1", 10);

        DashboardRevenueDTO revenue = dashboardService.getRevenueMetrics();
        assertThat(revenue.getTotalRevenue()).isEqualByComparingTo(BigDecimal.valueOf(250.00));
        assertThat(revenue.getSoldTickets()).isEqualTo(2);
        assertThat(revenue.getAverageTicketPrice()).isEqualByComparingTo(BigDecimal.valueOf(125.00));
        assertThat(revenue.getEvents())
                .extracting(item -> item.getEventName() + ":" + item.getSoldTickets())
                .contains("Revenue Event:2");

        DashboardOccupancyDTO occupancy = dashboardService.getOccupancyMetrics();
        assertThat(occupancy.getTotalSeats()).isEqualTo(5);
        assertThat(occupancy.getSoldSeats()).isEqualTo(2);
        assertThat(occupancy.getLockedSeats()).isEqualTo(1);
        assertThat(occupancy.getAvailableSeats()).isEqualTo(2);
        assertThat(occupancy.getOccupancyRate()).isEqualByComparingTo(BigDecimal.valueOf(40.00));
        assertThat(occupancy.getEvents())
                .extracting(item -> item.getEventName() + ":" + item.getOccupancyRate())
                .contains("Revenue Event:66.67", "Occupancy Event:0.00");
    }

    @Test
    void dashboardDemographicsAggregatesRegisteredCustomers() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS users");
        jdbcTemplate.execute("""
                CREATE TABLE users (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    age INTEGER,
                    gender VARCHAR(1)
                )
                """);

        jdbcTemplate.update(
                "INSERT INTO users (username, password, email, role, age, gender) VALUES (?, ?, ?, ?, ?, ?)",
                "alice", "secret", "alice@ticketrush.test", "CUSTOMER", 22, "F"
        );
        jdbcTemplate.update(
                "INSERT INTO users (username, password, email, role, age, gender) VALUES (?, ?, ?, ?, ?, ?)",
                "bob", "secret", "bob@ticketrush.test", "CUSTOMER", 31, "M"
        );
        jdbcTemplate.update(
                "INSERT INTO users (username, password, email, role, age, gender) VALUES (?, ?, ?, ?, ?, ?)",
                "charlie", "secret", "charlie@ticketrush.test", "CUSTOMER", 48, "M"
        );
        jdbcTemplate.update(
                "INSERT INTO users (username, password, email, role, age, gender) VALUES (?, ?, ?, ?, ?, ?)",
                "dana", "secret", "dana@ticketrush.test", "CUSTOMER", null, null
        );
        jdbcTemplate.update(
                "INSERT INTO users (username, password, email, role, age, gender) VALUES (?, ?, ?, ?, ?, ?)",
                "admin", "secret", "admin@ticketrush.test", "ADMIN", 35, "F"
        );

        DashboardDemographicsDTO demographics = dashboardService.getDemographicsMetrics();

        assertThat(demographics.isAvailable()).isTrue();
        assertThat(demographics.getScope()).isEqualTo("REGISTERED_CUSTOMERS");
        assertThat(demographics.getTotalCustomers()).isEqualTo(4);
        assertThat(demographics.getGenderBreakdown())
                .extracting(item -> item.getLabel() + ":" + item.getCount())
                .containsExactlyInAnyOrder("Male:2", "Female:1", "Unknown:1");
        assertThat(demographics.getAgeBreakdown())
                .extracting(item -> item.getLabel() + ":" + item.getCount())
                .containsExactlyInAnyOrder("18-24:1", "25-34:1", "45+:1", "Unknown:1");
    }

    private Venue createVenue(String name, String address, int capacity) {
        Venue venue = new Venue();
        venue.setName(name);
        venue.setAddress(address);
        venue.setTotalCapacity(capacity);
        return venueRepository.save(venue);
    }

    private VenueZone createZone(Venue venue, String name, String description) {
        VenueZone zone = new VenueZone();
        zone.setVenue(venue);
        zone.setName(name);
        zone.setDescription(description);
        return venueZoneRepository.save(zone);
    }

    private Event createEventEntity(String name, Venue venue) {
        Event event = new Event();
        event.setName(name);
        event.setCategory("Concert");
        event.setOrganizer("TicketRush");
        event.setDescription("Generated for integration testing");
        event.setLocation(venue.getAddress());
        event.setStartTime(LocalDateTime.of(2026, 9, 1, 19, 0));
        event.setEndTime(LocalDateTime.of(2026, 9, 1, 22, 0));
        event.setStatus("DRAFT");
        event.setVenue(venue);
        return eventRepository.save(event);
    }
}
