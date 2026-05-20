package com.ticketrush.bookingservice.service;

import com.ticketrush.bookingservice.dto.CouponDTO;
import com.ticketrush.bookingservice.dto.CouponValidationResultDTO;
import com.ticketrush.bookingservice.entity.Coupon;
import com.ticketrush.bookingservice.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CouponService {

    private final CouponRepository couponRepository;

    @Transactional
    public CouponDTO createCoupon(CouponDTO dto) {
        if (dto.getCode() == null || dto.getCode().trim().isEmpty()) {
            throw new RuntimeException("Mã giảm giá không được để trống");
        }
        if (dto.getDiscountType() == null || (!"PERCENTAGE".equalsIgnoreCase(dto.getDiscountType()) && !"FIXED".equalsIgnoreCase(dto.getDiscountType()))) {
            throw new RuntimeException("Loại giảm giá không hợp lệ");
        }
        if (dto.getDiscountValue() == null || dto.getDiscountValue().compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Giá trị giảm giá phải lớn hơn 0");
        }

        // Clean up code: uppercase & trim
        String code = dto.getCode().trim().toUpperCase();
        if (couponRepository.findByCodeIgnoreCase(code).isPresent()) {
            throw new RuntimeException("Mã giảm giá đã tồn tại");
        }

        Coupon coupon = new Coupon();
        coupon.setCode(code);
        coupon.setDiscountType(dto.getDiscountType().toUpperCase());
        coupon.setDiscountValue(dto.getDiscountValue());
        coupon.setMinOrderAmount(dto.getMinOrderAmount() != null ? dto.getMinOrderAmount() : BigDecimal.ZERO);
        coupon.setMaxDiscountAmount(dto.getMaxDiscountAmount());
        coupon.setExpiresAt(dto.getExpiresAt());
        coupon.setMaxUses(dto.getMaxUses());
        coupon.setUsedCount(0);
        coupon.setActive(dto.isActive());

        return mapToDTO(couponRepository.save(coupon));
    }

    @Transactional(readOnly = true)
    public List<CouponDTO> getAllCoupons() {
        return couponRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteCoupon(Long id) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy mã giảm giá"));
        couponRepository.delete(coupon);
    }

    @Transactional(readOnly = true)
    public CouponValidationResultDTO validateCoupon(String code, BigDecimal totalPrice) {
        if (code == null || code.trim().isEmpty()) {
            return new CouponValidationResultDTO(false, "Mã giảm giá trống", BigDecimal.ZERO, totalPrice);
        }

        String cleanCode = code.trim().toUpperCase();
        Coupon coupon = couponRepository.findByCodeIgnoreCase(cleanCode)
                .orElse(null);

        if (coupon == null) {
            return new CouponValidationResultDTO(false, "Mã giảm giá không tồn tại", BigDecimal.ZERO, totalPrice);
        }

        if (!coupon.isActive()) {
            return new CouponValidationResultDTO(false, "Mã giảm giá đã bị vô hiệu hóa", BigDecimal.ZERO, totalPrice);
        }

        if (coupon.getExpiresAt() != null && coupon.getExpiresAt().isBefore(LocalDateTime.now())) {
            return new CouponValidationResultDTO(false, "Mã giảm giá đã hết hạn", BigDecimal.ZERO, totalPrice);
        }

        if (coupon.getMaxUses() != null && coupon.getUsedCount() >= coupon.getMaxUses()) {
            return new CouponValidationResultDTO(false, "Mã giảm giá đã hết lượt sử dụng", BigDecimal.ZERO, totalPrice);
        }

        if (coupon.getMinOrderAmount() != null && totalPrice.compareTo(coupon.getMinOrderAmount()) < 0) {
            return new CouponValidationResultDTO(
                    false, 
                    "Đơn hàng chưa đạt giá trị tối thiểu " + coupon.getMinOrderAmount() + "đ để áp dụng mã này", 
                    BigDecimal.ZERO, 
                    totalPrice
            );
        }

        // Calculate discount amount
        BigDecimal discountAmount = BigDecimal.ZERO;
        if ("PERCENTAGE".equalsIgnoreCase(coupon.getDiscountType())) {
            BigDecimal percentage = coupon.getDiscountValue().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            discountAmount = totalPrice.multiply(percentage).setScale(0, RoundingMode.HALF_UP);

            if (coupon.getMaxDiscountAmount() != null && discountAmount.compareTo(coupon.getMaxDiscountAmount()) > 0) {
                discountAmount = coupon.getMaxDiscountAmount();
            }
        } else if ("FIXED".equalsIgnoreCase(coupon.getDiscountType())) {
            discountAmount = coupon.getDiscountValue();
        }

        if (discountAmount.compareTo(totalPrice) > 0) {
            discountAmount = totalPrice;
        }

        BigDecimal finalPrice = totalPrice.subtract(discountAmount);
        return new CouponValidationResultDTO(true, "Áp dụng mã giảm giá thành công", discountAmount, finalPrice);
    }

    @Transactional
    public CouponValidationResultDTO applyCoupon(String code, BigDecimal totalPrice) {
        CouponValidationResultDTO result = validateCoupon(code, totalPrice);
        if (!result.isValid()) {
            return result;
        }

        String cleanCode = code.trim().toUpperCase();
        Coupon coupon = couponRepository.findByCodeIgnoreCase(cleanCode)
                .orElseThrow(() -> new RuntimeException("Mã giảm giá không tồn tại"));

        // Increment used count
        coupon.setUsedCount(coupon.getUsedCount() + 1);
        couponRepository.save(coupon);

        return result;
    }

    private CouponDTO mapToDTO(Coupon coupon) {
        CouponDTO dto = new CouponDTO();
        dto.setId(coupon.getId());
        dto.setCode(coupon.getCode());
        dto.setDiscountType(coupon.getDiscountType());
        dto.setDiscountValue(coupon.getDiscountValue());
        dto.setMinOrderAmount(coupon.getMinOrderAmount());
        dto.setMaxDiscountAmount(coupon.getMaxDiscountAmount());
        dto.setExpiresAt(coupon.getExpiresAt());
        dto.setMaxUses(coupon.getMaxUses());
        dto.setUsedCount(coupon.getUsedCount());
        dto.setActive(coupon.isActive());
        return dto;
    }
}
