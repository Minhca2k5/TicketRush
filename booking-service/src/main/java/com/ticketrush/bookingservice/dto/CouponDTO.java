package com.ticketrush.bookingservice.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CouponDTO {
    private Long id;
    private String code;
    private String discountType; // "PERCENTAGE" or "FIXED"
    private BigDecimal discountValue;
    private BigDecimal minOrderAmount;
    private BigDecimal maxDiscountAmount;
    private LocalDateTime expiresAt;
    private Integer maxUses;
    private int usedCount;
    private boolean active;
}
