package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardRevenueDTO {
    private BigDecimal totalRevenue;
    private long soldTickets;
    private BigDecimal averageTicketPrice;
    private List<DashboardRevenueEventDTO> events;
    private List<DashboardRevenueCategoryDTO> categories;
}
