package com.ticketrush.bookingservice.repository;

import com.ticketrush.bookingservice.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserId(String userId);
    List<Order> findByUserIdAndStatusIgnoreCase(String userId, String status);
    List<Order> findByEventIdAndStatus(Long eventId, String status);
    boolean existsByUserIdAndEventIdAndStatusIgnoreCase(String userId, Long eventId, String status);
}
