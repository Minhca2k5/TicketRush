package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardRevenueEventDTO {
    private Long eventId;
    private String eventName;
    private String category;
    private String status;
    private BigDecimal revenue;
    private long soldTickets;
}
