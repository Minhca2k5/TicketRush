package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EventPriceTierDTO {
    private UUID id;
    private UUID eventId;
    private UUID zoneId;
    private String tierName;
    private BigDecimal price;
}
