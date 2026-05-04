package com.ticketrush.eventservice.config;

import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.entity.VenueZone;
import com.ticketrush.eventservice.entity.PriceTier;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.PriceTierRepository;
import com.ticketrush.eventservice.repository.SeatRepository;
import com.ticketrush.eventservice.repository.VenueZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final VenueZoneRepository venueZoneRepository;
    private final PriceTierRepository priceTierRepository;
    private final EventRepository eventRepository;
    private final SeatRepository seatRepository;

    @Override
    public void run(String... args) throws Exception {
        seedData();
    }

    private void seedData() {
        if (eventRepository.count() > 0)
            return;

        // Create Venue Zones
        VenueZone vipZone = new VenueZone();
        vipZone.setName("VIP");
        vipZone.setDescription("VIP Zone - Best view and comfort");
        venueZoneRepository.save(vipZone);

        VenueZone standardZone = new VenueZone();
        standardZone.setName("Standard");
        standardZone.setDescription("Standard Zone");
        venueZoneRepository.save(standardZone);

        // Create Price Tiers
        PriceTier vipPrice = new PriceTier();
        vipPrice.setName("VIP");
        vipPrice.setPrice(500000.0);
        priceTierRepository.save(vipPrice);

        PriceTier standardPrice = new PriceTier();
        standardPrice.setName("Standard");
        standardPrice.setPrice(200000.0);
        priceTierRepository.save(standardPrice);

        // Create Event
        Event event = new Event();
        event.setName("Concert: Rock Universe 2026");
        event.setDescription("Experience the biggest rock concert of the year!");
        event.setLocation("My Dinh National Stadium, Hanoi");
        event.setStartTime(LocalDateTime.of(2026, 5, 20, 19, 30));
        event.setImageUrl("https://thichtrangtri.com/wp-content/uploads/2025/05/anh-phong-canh-chill-29.jpg");
        Event savedEvent = eventRepository.save(event);

        // Create Seats: VIP zone - 5 rows (A-E), 5 seats each (25 seats)
        char[] vipRows = { 'A', 'B', 'C', 'D', 'E' };
        for (char row : vipRows) {
            for (int num = 1; num <= 5; num++) {
                Seat seat = new Seat();
                seat.setSeatNumber("" + row + num);
                seat.setStatus(row == 'A' && num <= 2 ? "SOLD" : "AVAILABLE");
                seat.setEvent(savedEvent);
                seat.setVenueZone(vipZone);
                seat.setPriceTier(vipPrice);
                seatRepository.save(seat);
            }
        }

        // Standard zone: 5 rows (F-J), 10 seats each (50 seats)
        char[] stdRows = { 'F', 'G', 'H', 'I', 'J' };
        for (char row : stdRows) {
            for (int num = 1; num <= 10; num++) {
                Seat seat = new Seat();
                seat.setSeatNumber("" + row + num);
                seat.setStatus(row == 'F' && num <= 3 ? "LOCKED" : "AVAILABLE");
                seat.setEvent(savedEvent);
                seat.setVenueZone(standardZone);
                seat.setPriceTier(standardPrice);
                seatRepository.save(seat);
            }
        }
    }
}
