package com.ticketrush.queueservice.dto;

import lombok.Data;

@Data
public class QueueStatusDTO {
    private String status; // WAITING or ALLOWED_TO_ENTER
    private long position;
    private long estimatedWaitMinutes;
}
