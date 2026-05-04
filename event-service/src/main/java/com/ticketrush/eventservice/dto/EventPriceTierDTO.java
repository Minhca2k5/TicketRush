package com.ticketrush.eventservice.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
public class EventPriceTierDTO {
    private String id;
    private Long eventId;
    private Long zoneId;
    private String zoneName;
    private String tierName;
    private BigDecimal price;

    public EventPriceTierDTO(String id, Long eventId, Long zoneId, String tierName, BigDecimal price) {
        this.id = id;
        this.eventId = eventId;
        this.zoneId = zoneId;
        this.tierName = tierName;
        this.price = price;
    }

    public EventPriceTierDTO(String id, Long eventId, Long zoneId, String zoneName, String tierName, BigDecimal price) {
        this.id = id;
        this.eventId = eventId;
        this.zoneId = zoneId;
        this.zoneName = zoneName;
        this.tierName = tierName;
        this.price = price;
    }
}
