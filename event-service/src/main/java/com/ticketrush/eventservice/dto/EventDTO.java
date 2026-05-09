package com.ticketrush.eventservice.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
public class EventDTO {
    private Long id;
    private String name;
    private String category;
    private String organizer;
    private String description;
    private String location;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String imageUrl;
    private String bannerUrl;
    private String status;
    private VenueDTO venue;
    private List<EventZoneConfigDTO> zones;
    private List<EventPriceTierDTO> priceTiers;
    private List<SeatDTO> seats;
    private JsonNode seatLayout;

    public EventDTO(
            Long id,
            String name,
            String category,
            String organizer,
            String description,
            String location,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String imageUrl,
            String bannerUrl,
            String status,
            VenueDTO venue,
            List<EventPriceTierDTO> priceTiers,
            List<SeatDTO> seats
    ) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.organizer = organizer;
        this.description = description;
        this.location = location;
        this.startTime = startTime;
        this.endTime = endTime;
        this.imageUrl = imageUrl;
        this.bannerUrl = bannerUrl;
        this.status = status;
        this.venue = venue;
        this.priceTiers = priceTiers;
        this.seats = seats;
    }
}
