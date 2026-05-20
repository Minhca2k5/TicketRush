package com.ticketrush.queueservice.controller;

import com.ticketrush.queueservice.dto.ApiResponse;
import com.ticketrush.queueservice.dto.QueueRequestDTO;
import com.ticketrush.queueservice.dto.QueueStatusDTO;
import com.ticketrush.queueservice.service.QueueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/queue")
@RequiredArgsConstructor
public class QueueController {

    private final QueueService queueService;

    @PostMapping("/join")
    public ResponseEntity<ApiResponse<QueueStatusDTO>> joinQueue(
            @RequestBody QueueRequestDTO request,
            @RequestHeader(value = "X-User-Id", required = false) String authenticatedUserId
    ) {
        String userId = resolveUserId(authenticatedUserId, request.getUserId());
        return ResponseEntity.ok(ApiResponse.success(
                "Joined queue successfully",
                queueService.joinQueue(request.getEventId(), userId)
        ));
    }

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<QueueStatusDTO>> getStatus(
            @RequestParam Long eventId,
            @RequestParam(required = false) String userId,
            @RequestHeader(value = "X-User-Id", required = false) String authenticatedUserId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Queue status fetched",
                queueService.getStatus(eventId, resolveUserId(authenticatedUserId, userId))
        ));
    }

    private String resolveUserId(String authenticatedUserId, String requestUserId) {
        if (authenticatedUserId != null && !authenticatedUserId.isBlank()) {
            return authenticatedUserId;
        }
        if (requestUserId != null && !requestUserId.isBlank()) {
            return requestUserId;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing queue user identity");
    }
}
