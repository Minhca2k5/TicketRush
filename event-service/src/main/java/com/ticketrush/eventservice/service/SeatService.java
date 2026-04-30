package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.dto.SeatBatchDTO;
import com.ticketrush.eventservice.dto.SeatCreationRequest;
import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.entity.VenueZone;
import com.ticketrush.eventservice.entity.PriceTier;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.PriceTierRepository;
import com.ticketrush.eventservice.repository.SeatRepository;
import com.ticketrush.eventservice.repository.VenueZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SeatService {

    private final EventRepository eventRepository;
    private final VenueZoneRepository venueZoneRepository;
    private final PriceTierRepository priceTierRepository;
    private final SeatRepository seatRepository;

    public void createSeatsForEvent(SeatCreationRequest request) {
        Event event = eventRepository.findById(request.getEventId())
                .orElseThrow(() -> new RuntimeException("Event not found"));

        List<Seat> seatsToSave = new ArrayList<>();

        for (SeatBatchDTO batch : request.getBatches()) {
            // Luôn tạo mới VenueZone (không reuse) để mỗi event có zone riêng
            VenueZone zone = new VenueZone();
            zone.setName(batch.getZoneName());
            zone.setDescription(batch.getZoneDescription() != null ? batch.getZoneDescription() : batch.getZoneName() + " Zone");
            zone = venueZoneRepository.save(zone);

            // Luôn tạo mới PriceTier (không reuse) để giá là theo batch
            PriceTier priceTier = new PriceTier();
            priceTier.setName(batch.getZoneName());
            priceTier.setPrice(batch.getPrice());
            priceTier = priceTierRepository.save(priceTier);

            // Tạo danh sách seats
            char startRow = 'A';
            for (int r = 0; r < batch.getRows(); r++) {
                char rowChar = (char) (startRow + r);
                for (int s = 1; s <= batch.getSeatsPerRow(); s++) {
                    Seat seat = new Seat();
                    seat.setSeatNumber("" + rowChar + s);
                    seat.setStatus("AVAILABLE");
                    seat.setEvent(event);
                    seat.setVenueZone(zone);
                    seat.setPriceTier(priceTier);
                    seatsToSave.add(seat);
                }
            }
        }

        seatRepository.saveAll(seatsToSave);
    }
}
