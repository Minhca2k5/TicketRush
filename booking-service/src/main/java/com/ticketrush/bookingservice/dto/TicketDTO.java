package com.ticketrush.bookingservice.dto;

import lombok.Data;

@Data
public class TicketDTO {
    private Long id;
    private Long seatId;
    private String qrCodeToken;
}
