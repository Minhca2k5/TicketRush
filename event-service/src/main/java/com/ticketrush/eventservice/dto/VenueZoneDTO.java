package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VenueZoneDTO {
    private Long id;
    private UUID venueId;
    private String name;
    private String description;
    private Integer seatCount;
}
