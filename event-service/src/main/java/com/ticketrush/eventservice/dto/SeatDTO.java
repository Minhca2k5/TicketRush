package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeatDTO {
    private Long id;
    private String seatNumber;
    private String rowName;
    private String status;
    private String lockHolder;
    private LocalDateTime lockExpiresAt;
    private VenueZoneDTO venueZone;
    private PriceTierDTO priceTier;
}
