package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardDemographicsDTO {
    private boolean available;
    private String scope;
    private String note;
    private long totalCustomers;
    private List<DashboardBreakdownItemDTO> genderBreakdown;
    private List<DashboardBreakdownItemDTO> ageBreakdown;
}
