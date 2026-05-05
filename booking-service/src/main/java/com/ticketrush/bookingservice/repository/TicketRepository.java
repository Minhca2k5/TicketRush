package com.ticketrush.bookingservice.repository;

import com.ticketrush.bookingservice.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {
    List<Ticket> findByOrderId(Long orderId);
}
