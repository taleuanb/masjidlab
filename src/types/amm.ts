export type Etage = 'RDC' | '1' | '2' | '3' | '4';

export type TypeSalle = 'Prière Homme' | 'Prière Femme' | 'Classe' | 'Cuisine' | 'Bureau' | 'Parking';

export type Pole = 'Social (ABD)' | 'Accueil' | 'Récolte' | 'Digital' | 'Com' | 'Imam' | 'École (Avenir)' | 'Parking';

export type StatutSalle = 'disponible' | 'occupée' | 'réservée' | 'maintenance';

export type Equipement = 'wifi' | 'micro' | 'clim' | 'vidéoprojecteur' | 'sono';

export interface Salle {
  id: string;
  nom: string;
  etage: Etage;
  type: TypeSalle;
  capacite: number;
  statut: StatutSalle;
  pole?: Pole;
  equipements?: Equipement[];
}

export interface Notification {
  id: string;
  type: 'stock' | 'message';
  titre: string;
  description: string;
  date: string;
  lu: boolean;
}

export interface Materiel {
  id: string;
  nom: string;
  categorie: 'Chaises' | 'Chapiteaux' | 'Sono' | 'Tables';
  quantiteTotal: number;
  quantiteDisponible: number;
  emplacement: string;
}

export interface Reservation {
  id: string;
  salleId: string;
  titre: string;
  debut: string;
  fin: string;
  pole: Pole;
  materiel?: { materielId: string; quantite: number }[];
}

export interface Recolte {
  id: string;
  date: string;
  montant: number;
  type: 'Joumou\'a' | 'Campagne' | 'Don' | 'Autre';
  description?: string;
  pole?: Pole;
}
