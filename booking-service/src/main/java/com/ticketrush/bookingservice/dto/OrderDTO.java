package com.ticketrush.bookingservice.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderDTO {
    private Long id;
    private String userId;
    private Long eventId;
    private BigDecimal totalPrice;
    private BigDecimal originalPrice;
    private BigDecimal discountAmount;
    private String couponCode;
    private String status;
    private LocalDateTime createdAt;
    private List<TicketDTO> tickets;
}
