package com.ticketrush.eventservice.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.SQLException;

@Component
public class EventSchemaMaintenance implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public EventSchemaMaintenance(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        if (!isPostgres()) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE IF EXISTS events ALTER COLUMN description TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE IF EXISTS events ALTER COLUMN location TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE IF EXISTS events ALTER COLUMN image_url TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE IF EXISTS events ALTER COLUMN banner_url TYPE TEXT");
        jdbcTemplate.execute("ALTER TABLE IF EXISTS events ALTER COLUMN seat_layout_json TYPE TEXT");
    }

    private boolean isPostgres() {
        if (jdbcTemplate.getDataSource() == null) {
            return false;
        }

        try (Connection connection = jdbcTemplate.getDataSource().getConnection()) {
            return "PostgreSQL".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName());
        } catch (SQLException exception) {
            return false;
        }
    }
}
