package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeatMapLayoutDTO {
    private Long eventId;
    private String eventName;
    private VenueDTO venue;
    private Integer totalSeats;
    private Integer availableSeats;
    private Integer bookedSeats;
    private Integer lockedSeats;
    private List<SeatZoneLayoutDTO> zones;
}
