import { Salle, Materiel, Reservation, Recolte, Etage } from '@/types/amm';

export const ETAGES: { value: Etage; label: string }[] = [
  { value: 'RDC', label: 'Rez-de-chaussée' },
  { value: '1', label: '1er Étage' },
  { value: '2', label: '2ème Étage' },
  { value: '3', label: '3ème Étage' },
  { value: '4', label: '4ème Étage' },
];

export const sallesMock: Salle[] = [
  { id: '1', nom: 'Salle de Prière Principale', etage: 'RDC', type: 'Prière Homme', capacite: 500, statut: 'occupée', pole: 'Imam' },
  { id: '2', nom: 'Salle de Prière Femmes', etage: 'RDC', type: 'Prière Femme', capacite: 200, statut: 'disponible' },
  { id: '3', nom: 'Parking Souterrain', etage: 'RDC', type: 'Parking', capacite: 50, statut: 'disponible', pole: 'Parking' },
  { id: '4', nom: 'Bureau Administratif', etage: '1', type: 'Bureau', capacite: 10, statut: 'occupée', pole: 'Digital' },
  { id: '5', nom: 'Classe Coran 1', etage: '1', type: 'Classe', capacite: 30, statut: 'réservée', pole: 'École (Avenir)' },
  { id: '6', nom: 'Classe Coran 2', etage: '1', type: 'Classe', capacite: 30, statut: 'disponible', pole: 'École (Avenir)' },
  { id: '7', nom: 'Cuisine Centrale', etage: '2', type: 'Cuisine', capacite: 15, statut: 'disponible', pole: 'Social (ABD)' },
  { id: '8', nom: 'Salle Polyvalente', etage: '2', type: 'Classe', capacite: 80, statut: 'réservée', pole: 'Accueil' },
  { id: '9', nom: 'Bureau Com & Digital', etage: '3', type: 'Bureau', capacite: 8, statut: 'disponible', pole: 'Com' },
  { id: '10', nom: 'Salle de Réunion', etage: '3', type: 'Bureau', capacite: 20, statut: 'disponible' },
  { id: '11', nom: 'Salle de Classe 3', etage: '4', type: 'Classe', capacite: 25, statut: 'maintenance' },
  { id: '12', nom: 'Terrasse Événement', etage: '4', type: 'Classe', capacite: 100, statut: 'disponible', pole: 'Récolte' },
];

export const materielMock: Materiel[] = [
  { id: '1', nom: 'Chaises pliantes', categorie: 'Chaises', quantiteTotal: 200, quantiteDisponible: 145, emplacement: 'RDC - Stockage' },
  { id: '2', nom: 'Chaises enfants', categorie: 'Chaises', quantiteTotal: 50, quantiteDisponible: 50, emplacement: '1er - Classe' },
  { id: '3', nom: 'Chapiteau 6x3m', categorie: 'Chapiteaux', quantiteTotal: 4, quantiteDisponible: 2, emplacement: 'Parking' },
  { id: '4', nom: 'Sono portable', categorie: 'Sono', quantiteTotal: 3, quantiteDisponible: 1, emplacement: 'Bureau Admin' },
  { id: '5', nom: 'Micro sans fil', categorie: 'Sono', quantiteTotal: 8, quantiteDisponible: 5, emplacement: 'Bureau Admin' },
  { id: '6', nom: 'Tables rectangulaires', categorie: 'Tables', quantiteTotal: 30, quantiteDisponible: 22, emplacement: 'RDC - Stockage' },
  { id: '7', nom: 'Tables rondes', categorie: 'Tables', quantiteTotal: 10, quantiteDisponible: 10, emplacement: '2ème - Polyvalente' },
];

export const reservationsMock: Reservation[] = [
  { id: '1', salleId: '1', titre: 'Salat Joumou\'a', debut: '2026-02-17T12:00', fin: '2026-02-17T14:00', pole: 'Imam' },
  { id: '2', salleId: '5', titre: 'Cours Coran - Groupe A', debut: '2026-02-17T09:00', fin: '2026-02-17T11:00', pole: 'École (Avenir)' },
  { id: '3', salleId: '8', titre: 'Distribution alimentaire', debut: '2026-02-17T15:00', fin: '2026-02-17T18:00', pole: 'Social (ABD)', materiel: [{ materielId: '1', quantite: 55 }, { materielId: '6', quantite: 8 }] },
];

export const recoltesMock: Recolte[] = [
  { id: '1', date: '2026-02-14', montant: 3200, type: 'Joumou\'a', description: 'Collecte vendredi' },
  { id: '2', date: '2026-02-07', montant: 2850, type: 'Joumou\'a', description: 'Collecte vendredi' },
  { id: '3', date: '2026-02-10', montant: 15000, type: 'Campagne', description: 'Campagne Ramadan', pole: 'Récolte' },
  { id: '4', date: '2026-02-01', montant: 500, type: 'Don', description: 'Don anonyme' },
];
