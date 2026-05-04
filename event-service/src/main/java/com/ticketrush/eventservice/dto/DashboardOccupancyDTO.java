package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardOccupancyDTO {
    private int totalSeats;
    private int soldSeats;
    private int lockedSeats;
    private int availableSeats;
    private BigDecimal occupancyRate;
    private List<DashboardEventOccupancyDTO> events;
}
