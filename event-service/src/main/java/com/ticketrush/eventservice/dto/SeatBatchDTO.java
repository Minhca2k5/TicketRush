package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeatBatchDTO {
    private String zoneName;
    private String zoneDescription;
    private Double price;
    private Integer rows;
    private Integer seatsPerRow;
}
