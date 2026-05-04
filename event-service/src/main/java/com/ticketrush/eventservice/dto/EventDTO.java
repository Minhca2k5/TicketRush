package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
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
    private List<EventPriceTierDTO> priceTiers;
    private List<SeatDTO> seats;
}
