package com.ticketrush.eventservice.dto;

import lombok.Data;

@Data
public class EventReviewRequestDTO {
    private String userId;
    private String userName;
    private Integer rating;
    private String comment;
}
