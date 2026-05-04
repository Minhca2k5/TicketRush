package com.ticketrush.eventservice.config;

import com.ticketrush.eventservice.dto.EventDTO;
import com.ticketrush.eventservice.dto.SeatBatchDTO;
import com.ticketrush.eventservice.dto.SeatCreationRequest;
import com.ticketrush.eventservice.dto.VenueDTO;
import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.Venue;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.VenueRepository;
import com.ticketrush.eventservice.service.EventService;
import com.ticketrush.eventservice.service.SeatService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true", matchIfMissing = true)
public class SeedDataLoader implements CommandLineRunner {

    private final EventRepository eventRepository;
    private final VenueRepository venueRepository;
    private final EventService eventService;
    private final SeatService seatService;

    @Override
    @Transactional
    public void run(String... args) {
        Venue centralPark = ensureVenue("Central Park Stage", "Central Park, New York, NY", 12000);
        Venue grandArena = ensureVenue("Grand Hall Arena", "Los Angeles Convention District, CA", 9000);
        Venue riverside = ensureVenue("Riverside Theater", "Chicago Riverfront, IL", 4500);
        Venue skylineDome = ensureVenue("Skyline Dome", "San Francisco Bay District, CA", 15000);
        Venue harborCenter = ensureVenue("Harbor Conference Center", "Seattle Waterfront, WA", 3200);

        ensureEvent(
                centralPark,
                "Summer Music Festival 2026",
                "Concert",
                "Aurora Entertainment",
                "A flagship outdoor music festival with premium seating zones and timed entry.",
                "LIVE",
                "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=80",
                LocalDateTime.now().plusDays(10).withHour(18).withMinute(30),
                LocalDateTime.now().plusDays(10).withHour(23).withMinute(0),
                List.of(
                        new SeatBatchDTO("VIP", "Front section near the stage", 250.0, 3, 8),
                        new SeatBatchDTO("General", "Main audience zone", 99.0, 5, 14)
                )
        );

        ensureEvent(
                grandArena,
                "Championship Night Finals",
                "Sport",
                "Prime Sports Co",
                "High-demand arena event with premium courtside seats and general bowl seating.",
                "PENDING",
                "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1400&q=80",
                LocalDateTime.now().plusDays(20).withHour(19).withMinute(0),
                LocalDateTime.now().plusDays(20).withHour(22).withMinute(30),
                List.of(
                        new SeatBatchDTO("Courtside", "Best available visibility", 320.0, 2, 10),
                        new SeatBatchDTO("Standard", "Arena bowl seating", 140.0, 6, 16)
                )
        );

        ensureEvent(
                riverside,
                "Midnight Orchestra",
                "Theater",
                "Silver Note Productions",
                "A premium indoor performance with intimate seating and balcony access.",
                "DRAFT",
                "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80",
                LocalDateTime.now().plusDays(35).withHour(20).withMinute(0),
                LocalDateTime.now().plusDays(35).withHour(22).withMinute(0),
                List.of(
                        new SeatBatchDTO("Orchestra", "Ground-floor premium seating", 180.0, 4, 10),
                        new SeatBatchDTO("Balcony", "Elevated theater seating", 110.0, 3, 12)
                )
        );

        ensureEvent(
                skylineDome,
                "Neon Skyline Festival",
                "Concert",
                "Luma Live",
                "An immersive EDM festival with panoramic visuals, LED wristbands, and late-night aftershow sets.",
                "LIVE",
                "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80",
                LocalDateTime.now().plusDays(18).withHour(19).withMinute(30),
                LocalDateTime.now().plusDays(19).withHour(0).withMinute(30),
                List.of(
                        new SeatBatchDTO("Sky Deck", "Elevated premium viewing deck", 280.0, 2, 12),
                        new SeatBatchDTO("Floor", "Main standing and seated festival floor", 125.0, 6, 18)
                )
        );

        ensureEvent(
                harborCenter,
                "Future Summit 2026",
                "Conference",
                "Northstar Labs",
                "A curated technology summit focused on AI products, startup operators, and modern digital experiences.",
                "LIVE",
                "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80",
                LocalDateTime.now().plusDays(28).withHour(9).withMinute(0),
                LocalDateTime.now().plusDays(28).withHour(17).withMinute(30),
                List.of(
                        new SeatBatchDTO("Executive", "Front conference rows with lounge access", 210.0, 3, 10),
                        new SeatBatchDTO("General Admission", "Main conference seating", 85.0, 8, 14)
                )
        );
    }

    private Venue ensureVenue(String name, String address, int capacity) {
        return venueRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> {
                    Venue venue = new Venue();
                    venue.setName(name);
                    venue.setAddress(address);
                    venue.setTotalCapacity(capacity);
                    return venueRepository.save(venue);
                });
    }

    private void ensureEvent(
            Venue venue,
            String name,
            String category,
            String organizer,
            String description,
            String status,
            String imageUrl,
            LocalDateTime startTime,
            LocalDateTime endTime,
            List<SeatBatchDTO> seatBatches
    ) {
        if (eventRepository.findByNameIgnoreCase(name).isPresent()) {
            return;
        }

        EventDTO createdEvent = eventService.createEvent(new EventDTO(
                null,
                name,
                category,
                organizer,
                description,
                venue.getAddress(),
                startTime,
                endTime,
                imageUrl,
                imageUrl,
                status,
                new VenueDTO(venue.getId(), venue.getName(), venue.getAddress(), venue.getTotalCapacity()),
                null,
                null
        ));

        seatService.createSeatsForEvent(new SeatCreationRequest(createdEvent.getId(), seatBatches));
    }
}
