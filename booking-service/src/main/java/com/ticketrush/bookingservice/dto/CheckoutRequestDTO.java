package com.ticketrush.bookingservice.dto;

import lombok.Data;
import java.util.List;

@Data
public class CheckoutRequestDTO {
    private Long eventId;
    private List<Long> seatIds;
    private String holderId;
}
