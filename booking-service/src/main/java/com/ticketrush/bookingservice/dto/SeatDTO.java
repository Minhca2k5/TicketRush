package com.ticketrush.bookingservice.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class SeatDTO {
    private Long id;
    private String seatNumber;
    private String rowName;
    private String status;
    private String lockHolder;
    private LocalDateTime lockExpiresAt;
    private PriceTierDTO priceTier;
}
