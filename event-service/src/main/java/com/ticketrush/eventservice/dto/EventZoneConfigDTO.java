package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EventZoneConfigDTO {
    private Long id;
    private String name;
    private String description;
    private Integer rows;
    private Integer seatsPerRow;
    private String rowPrefix;
    private Integer seatCount;
}
