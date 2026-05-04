package com.ticketrush.eventservice.controller;

import com.ticketrush.eventservice.dto.ApiResponse;
import com.ticketrush.eventservice.dto.VenueDTO;
import com.ticketrush.eventservice.dto.VenueZoneDTO;
import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.entity.Venue;
import com.ticketrush.eventservice.entity.VenueZone;
import com.ticketrush.eventservice.repository.SeatRepository;
import com.ticketrush.eventservice.repository.VenueRepository;
import com.ticketrush.eventservice.repository.VenueZoneRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/venues")
@RequiredArgsConstructor
public class VenueController {

    private static final Logger log = LoggerFactory.getLogger(VenueController.class);
    private final VenueRepository venueRepository;
    private final VenueZoneRepository venueZoneRepository;
    private final SeatRepository seatRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<VenueDTO>>> getAllVenues() {
        List<VenueDTO> venues = venueRepository.findAll().stream().map(v -> {
            VenueDTO dto = new VenueDTO();
            dto.setId(v.getId());
            dto.setName(v.getName());
            dto.setAddress(v.getAddress());
            dto.setTotalCapacity(v.getTotalCapacity());
            return dto;
        }).collect(Collectors.toList());
        log.info("[VenueController] Returning {} venues", venues.size());
        return ResponseEntity.ok(ApiResponse.success("Venues fetched successfully", venues));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<VenueDTO>> createVenue(@RequestBody VenueDTO dto) {
        Venue venue = new Venue();
        venue.setName(dto.getName() != null ? dto.getName() : "Custom Venue");
        venue.setAddress(dto.getAddress() != null ? dto.getAddress() : "N/A");
        venue.setTotalCapacity(dto.getTotalCapacity() != null ? dto.getTotalCapacity() : 0);
        Venue saved = venueRepository.save(venue);
        log.info("[VenueController] Created new venue id={} name={}", saved.getId(), saved.getName());
        VenueDTO result = new VenueDTO(saved.getId(), saved.getName(), saved.getAddress(), saved.getTotalCapacity());
        return ResponseEntity.ok(ApiResponse.success("Venue created successfully", result));
    }

    @GetMapping("/{id}/zones")
    public ResponseEntity<ApiResponse<List<VenueZoneDTO>>> getVenueZones(@PathVariable UUID id) {
        List<VenueZoneDTO> zones = venueZoneRepository.findByVenueId(id).stream().map(z -> {
            VenueZoneDTO dto = new VenueZoneDTO();
            dto.setId(z.getId());
            dto.setVenueId(z.getVenue().getId());
            dto.setName(z.getName());
            dto.setDescription(z.getDescription());
            long seatCount = seatRepository.findByVenueZoneId(z.getId()).size();
            dto.setSeatCount((int) seatCount);
            return dto;
        }).collect(Collectors.toList());
        log.info("[VenueController] Venue {} has {} zones", id, zones.size());
        return ResponseEntity.ok(ApiResponse.success("Venue zones fetched successfully", zones));
    }

    @PostMapping("/{id}/zones")
    public ResponseEntity<ApiResponse<VenueZoneDTO>> createZone(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        Venue venue = venueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Venue not found"));
        VenueZone zone = new VenueZone();
        zone.setVenue(venue);
        zone.setName(body.getOrDefault("name", "Zone"));
        zone.setDescription(body.getOrDefault("description", ""));
        VenueZone saved = venueZoneRepository.save(zone);
        log.info("[VenueController] Created zone id={} name={} for venue={}", saved.getId(), saved.getName(), id);
        VenueZoneDTO dto = new VenueZoneDTO(saved.getId(), id, saved.getName(), saved.getDescription(), 0);
        return ResponseEntity.ok(ApiResponse.success("Zone created successfully", dto));
    }

    /**
     * Configure seat grid for a zone.
     * Clears existing seats and regenerates a new rows x seatsPerRow grid.
     * Body: { "rows": 5, "seatsPerRow": 10, "rowPrefix": "R" }
     */
    @PostMapping("/{venueId}/zones/{zoneId}/seats/configure")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> configureSeats(
            @PathVariable UUID venueId,
            @PathVariable Long zoneId,
            @RequestBody Map<String, Object> body) {

        log.info("[VenueController] Configuring seats for venue={} zone={}", venueId, zoneId);
        VenueZone zone = venueZoneRepository.findById(zoneId)
                .orElseThrow(() -> new RuntimeException("Zone not found"));

        if (!zone.getVenue().getId().equals(venueId)) {
            log.error("[VenueController] Zone {} does not belong to venue {}", zoneId, venueId);
            throw new RuntimeException("Zone does not belong to the specified venue");
        }

        int rows = Integer.parseInt(body.getOrDefault("rows", 5).toString());
        int seatsPerRow = Integer.parseInt(body.getOrDefault("seatsPerRow", 10).toString());
        String rowPrefix = body.getOrDefault("rowPrefix", "R").toString().toUpperCase();

        log.info("[VenueController] Request to create {} rows x {} seats (Prefix: {})", rows, seatsPerRow, rowPrefix);

        // Clamp to reasonable limits
        rows = Math.max(1, Math.min(rows, 30));
        seatsPerRow = Math.max(1, Math.min(seatsPerRow, 50));

        // Delete existing seats for this zone
        List<Seat> existing = seatRepository.findByVenueZoneId(zoneId);
        log.info("[VenueController] Found {} existing seats to remove", existing.size());
        seatRepository.deleteAll(existing);
        seatRepository.flush(); // Force delete before insert to avoid constraint issues

        // Generate new seat grid
        List<Seat> newSeats = new ArrayList<>();
        for (int r = 1; r <= rows; r++) {
            for (int s = 1; s <= seatsPerRow; s++) {
                Seat seat = new Seat();
                seat.setVenueZone(zone);
                seat.setRowName(rowPrefix + r);
                seat.setSeatNumber(rowPrefix + r + "-" + s);
                seat.setCoordinateX(BigDecimal.valueOf(s * 15.0)); // Increased spacing for better UI
                seat.setCoordinateY(BigDecimal.valueOf(r * 15.0));
                seat.setStatus("AVAILABLE");
                newSeats.add(seat);
            }
        }
        seatRepository.saveAll(newSeats);

        log.info("[VenueController] Successfully created {} seats for zone={} ({})",
                newSeats.size(), zone.getName(), zoneId);

        return ResponseEntity.ok(ApiResponse.success("Seats configured successfully",
                Map.of("zone", zone.getName(), "rows", rows, "seatsPerRow", seatsPerRow, "totalSeats", newSeats.size())));
    }
}
