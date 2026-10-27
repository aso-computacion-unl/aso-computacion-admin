import { BrandLogo } from "./_components/brand-mark";
import { NotFoundState } from "./_components/not-found-state";

// The fallback for an address outside the admin and the forum: no product shell wraps it, so it brings the brand.
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="grid w-full max-w-sm justify-items-start">
        <BrandLogo alt="ASO Computación" width={168} className="mb-6 h-auto w-42" />
        <NotFoundState title="Página no encontrada" href="/admin" actionLabel="Ir al panel">
          La dirección no existe o fue movida.
        </NotFoundState>
      </div>
    </main>
  );
}
