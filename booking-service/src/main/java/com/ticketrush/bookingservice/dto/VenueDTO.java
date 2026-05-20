package com.ticketrush.bookingservice.dto;

import lombok.Data;

@Data
public class VenueDTO {
    private Long id;
    private String name;
    private String address;
    private Integer totalCapacity;
}
