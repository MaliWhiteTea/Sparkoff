import type { Metadata } from "next";
import BookingForm from "./booking-form";

export const metadata: Metadata = {
  title: "Randevu Oluştur | Sparkoff Proje Atölyesi",
  description: "3D yazıcı için uygun zamanı seçin ve baskı dosyanızla randevu talebi oluşturun.",
};

export default function BookingPage() {
  return <BookingForm />;
}
