package com.ticketrush.bookingservice.controller;

import com.ticketrush.bookingservice.dto.ApiResponse;
import com.ticketrush.bookingservice.dto.CouponDTO;
import com.ticketrush.bookingservice.dto.CouponValidationResultDTO;
import com.ticketrush.bookingservice.service.CouponService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/booking")
@RequiredArgsConstructor
public class CouponController {

    private final CouponService couponService;

    @GetMapping("/coupons/validate")
    public ResponseEntity<ApiResponse<CouponValidationResultDTO>> validateCoupon(
            @RequestParam String code,
            @RequestParam BigDecimal totalPrice
    ) {
        CouponValidationResultDTO result = couponService.validateCoupon(code, totalPrice);
        if (result.isValid()) {
            return ResponseEntity.ok(ApiResponse.success(result.getMessage(), result));
        } else {
            return ResponseEntity.ok(ApiResponse.error(result.getMessage(), result));
        }
    }

    @GetMapping("/admin/coupons")
    public ResponseEntity<ApiResponse<List<CouponDTO>>> getAllCoupons() {
        List<CouponDTO> coupons = couponService.getAllCoupons();
        return ResponseEntity.ok(ApiResponse.success("Coupons fetched successfully", coupons));
    }

    @PostMapping("/admin/coupons")
    public ResponseEntity<ApiResponse<CouponDTO>> createCoupon(@RequestBody CouponDTO couponDTO) {
        CouponDTO created = couponService.createCoupon(couponDTO);
        return ResponseEntity.ok(ApiResponse.success("Coupon created successfully", created));
    }

    @DeleteMapping("/admin/coupons/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCoupon(@PathVariable Long id) {
        couponService.deleteCoupon(id);
        return ResponseEntity.ok(ApiResponse.success("Coupon deleted successfully", null));
    }
}
