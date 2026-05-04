package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardEventOccupancyDTO {
    private Long eventId;
    private String eventName;
    private String venueName;
    private String status;
    private int totalSeats;
    private int soldSeats;
    private int lockedSeats;
    private int availableSeats;
    private BigDecimal occupancyRate;
}
