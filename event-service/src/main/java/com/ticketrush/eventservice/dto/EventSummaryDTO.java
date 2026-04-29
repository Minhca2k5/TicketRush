package com.ticketrush.eventservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EventSummaryDTO {
    private Long id;
    private String name;
    private String description;
    private String location;
    private LocalDateTime startTime;
    private String imageUrl;
}
