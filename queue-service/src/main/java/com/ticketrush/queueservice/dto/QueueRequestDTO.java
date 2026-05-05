package com.ticketrush.queueservice.dto;

import lombok.Data;

@Data
public class QueueRequestDTO {
    private Long eventId;
    private String userId;
}
