package com.ticketrush.bookingservice.config;

import com.ticketrush.bookingservice.entity.Coupon;
import com.ticketrush.bookingservice.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class SeedCouponLoader implements CommandLineRunner {

    private final CouponRepository couponRepository;

    @Override
    @Transactional
    public void run(String... args) {
        ensureCoupon("SUMMER20", "PERCENTAGE", BigDecimal.valueOf(20), BigDecimal.ZERO, BigDecimal.valueOf(100000), 100);
        ensureCoupon("TICKET50", "FIXED", BigDecimal.valueOf(50000), BigDecimal.valueOf(100000), null, 200);
        ensureCoupon("WELCOME10", "PERCENTAGE", BigDecimal.valueOf(10), BigDecimal.ZERO, BigDecimal.valueOf(50000), 500);
    }

    private void ensureCoupon(String code, String type, BigDecimal value, BigDecimal minOrder, BigDecimal maxDiscount, int maxUses) {
        if (couponRepository.findByCodeIgnoreCase(code).isPresent()) {
            return;
        }

        Coupon coupon = new Coupon();
        coupon.setCode(code.toUpperCase());
        coupon.setDiscountType(type.toUpperCase());
        coupon.setDiscountValue(value);
        coupon.setMinOrderAmount(minOrder);
        coupon.setMaxDiscountAmount(maxDiscount);
        coupon.setExpiresAt(LocalDateTime.now().plusMonths(3));
        coupon.setMaxUses(maxUses);
        coupon.setUsedCount(0);
        coupon.setActive(true);

        couponRepository.save(coupon);
    }
}
