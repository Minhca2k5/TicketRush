package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeatLayoutItemDTO {
    private Long id;
    private String seatNumber;
    private String rowName;
    private String status;
    private String lockHolder;
    private LocalDateTime lockExpiresAt;
    private BigDecimal coordinateX;
    private BigDecimal coordinateY;
    private PriceTierDTO priceTier;
}
