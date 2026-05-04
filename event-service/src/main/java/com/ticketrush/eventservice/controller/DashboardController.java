package com.ticketrush.eventservice.controller;

import com.ticketrush.eventservice.dto.ApiResponse;
import com.ticketrush.eventservice.dto.DashboardDemographicsDTO;
import com.ticketrush.eventservice.dto.DashboardOccupancyDTO;
import com.ticketrush.eventservice.dto.DashboardRevenueDTO;
import com.ticketrush.eventservice.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/revenue")
    public ResponseEntity<ApiResponse<DashboardRevenueDTO>> getRevenueMetrics() {
        return ResponseEntity.ok(
                ApiResponse.success("Dashboard revenue fetched successfully", dashboardService.getRevenueMetrics())
        );
    }

    @GetMapping("/occupancy")
    public ResponseEntity<ApiResponse<DashboardOccupancyDTO>> getOccupancyMetrics() {
        return ResponseEntity.ok(
                ApiResponse.success("Dashboard occupancy fetched successfully", dashboardService.getOccupancyMetrics())
        );
    }

    @GetMapping("/demographics")
    public ResponseEntity<ApiResponse<DashboardDemographicsDTO>> getDemographicsMetrics() {
        return ResponseEntity.ok(
                ApiResponse.success("Dashboard demographics fetched successfully", dashboardService.getDemographicsMetrics())
        );
    }
}
