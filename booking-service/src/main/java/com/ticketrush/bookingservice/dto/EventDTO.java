package com.ticketrush.bookingservice.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class EventDTO {
    private Long id;
    private String name;
    private String location;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private VenueDTO venue;
}
