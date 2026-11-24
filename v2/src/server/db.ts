import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL tanımlanmalı');
export const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 8, decimalNumbers: false, timezone: 'Z' });
pool.pool.on('connection', connection => {
  connection.query("SET time_zone = '+00:00'", error => { if (error) connection.destroy(); });
});
export const db = drizzle(pool);
