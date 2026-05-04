package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeatZoneLayoutDTO {
    private Long zoneId;
    private String zoneName;
    private String zoneDescription;
    private String tierName;
    private BigDecimal price;
    private Integer seatCount;
    private List<SeatRowLayoutDTO> rows;
}
