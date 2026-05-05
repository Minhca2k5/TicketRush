package com.ticketrush.queueservice.controller;

import com.ticketrush.queueservice.dto.ApiResponse;
import com.ticketrush.queueservice.dto.QueueRequestDTO;
import com.ticketrush.queueservice.dto.QueueStatusDTO;
import com.ticketrush.queueservice.service.QueueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/queue")
@RequiredArgsConstructor
public class QueueController {

    private final QueueService queueService;

    @PostMapping("/join")
    public ResponseEntity<ApiResponse<QueueStatusDTO>> joinQueue(@RequestBody QueueRequestDTO request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Joined queue successfully",
                queueService.joinQueue(request.getEventId(), request.getUserId())
        ));
    }

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<QueueStatusDTO>> getStatus(
            @RequestParam Long eventId,
            @RequestParam String userId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Queue status fetched",
                queueService.getStatus(eventId, userId)
        ));
    }
}
