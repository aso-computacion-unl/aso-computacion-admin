import Link from "next/link";

import { createPillar } from "@/interface/admin/pillars/actions";

import { PillarForm } from "../_components/pillar-form";

export default function NewPillarPage() {
  return (
    <section>
      <p>
        <Link href="/admin/pillars">← Volver a pilares</Link>
      </p>
      <h1>Crear pilar</h1>
      <p>Se agrega al final de la lista. La imagen se sube en el paso siguiente.</p>
      <PillarForm action={createPillar} submitLabel="Crear pilar" />
    </section>
  );
}
