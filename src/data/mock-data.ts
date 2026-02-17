import { Salle, Materiel, Reservation, Recolte, Etage, Notification, TicketMaintenance, Evenement, PlaceParking, BenevoleParkingPoste } from '@/types/amm';

export const ETAGES: { value: Etage; label: string }[] = [
  { value: 'RDC', label: 'Rez-de-chaussée' },
  { value: '1', label: '1er Étage' },
  { value: '2', label: '2ème Étage' },
  { value: '3', label: '3ème Étage' },
  { value: '4', label: '4ème Étage' },
];

export const sallesMock: Salle[] = [
  { id: '1', nom: 'Salle de Prière Principale', etage: 'RDC', type: 'Prière Homme', capacite: 500, statut: 'occupée', pole: 'Imam', equipements: ['micro', 'sono', 'clim'] },
  { id: '2', nom: 'Salle de Prière Femmes', etage: 'RDC', type: 'Prière Femme', capacite: 200, statut: 'disponible', equipements: ['clim', 'micro'] },
  { id: '3', nom: 'Parking Souterrain', etage: 'RDC', type: 'Parking', capacite: 50, statut: 'disponible', pole: 'Parking' },
  { id: '4', nom: 'Bureau Administratif', etage: '1', type: 'Bureau', capacite: 10, statut: 'occupée', pole: 'Digital', equipements: ['wifi', 'clim'] },
  { id: '5', nom: 'Classe Coran 1', etage: '1', type: 'Classe', capacite: 30, statut: 'réservée', pole: 'École (Avenir)', equipements: ['wifi', 'vidéoprojecteur'] },
  { id: '6', nom: 'Classe Coran 2', etage: '1', type: 'Classe', capacite: 30, statut: 'disponible', pole: 'École (Avenir)', equipements: ['wifi'] },
  { id: '7', nom: 'Cuisine Centrale', etage: '2', type: 'Cuisine', capacite: 15, statut: 'disponible', pole: 'Social (ABD)' },
  { id: '8', nom: 'Salle Polyvalente', etage: '2', type: 'Classe', capacite: 80, statut: 'réservée', pole: 'Accueil', equipements: ['wifi', 'micro', 'sono', 'vidéoprojecteur', 'clim'] },
  { id: '9', nom: 'Bureau Com & Digital', etage: '3', type: 'Bureau', capacite: 8, statut: 'disponible', pole: 'Com', equipements: ['wifi', 'clim'] },
  { id: '10', nom: 'Salle de Réunion', etage: '3', type: 'Bureau', capacite: 20, statut: 'disponible', equipements: ['wifi', 'vidéoprojecteur', 'clim'] },
  { id: '11', nom: 'Salle de Classe 3', etage: '4', type: 'Classe', capacite: 25, statut: 'maintenance' },
  { id: '12', nom: 'Terrasse Événement', etage: '4', type: 'Classe', capacite: 100, statut: 'disponible', pole: 'Récolte', equipements: ['sono', 'micro'] },
];

export const notificationsMock: Notification[] = [
  { id: '1', type: 'stock', titre: 'Stock critique : Sono portable', description: 'Plus que 1 sono portable disponible sur 3.', date: '2026-02-17T10:30', lu: false },
  { id: '2', type: 'stock', titre: 'Stock bas : Chapiteaux', description: 'Plus que 2 chapiteaux disponibles sur 4.', date: '2026-02-17T09:15', lu: false },
  { id: '3', type: 'message', titre: 'Réunion du Conseil', description: 'Prochaine réunion du Conseil de la Mosquée le 20/02 à 20h.', date: '2026-02-16T18:00', lu: false },
  { id: '4', type: 'message', titre: 'Ramadan : Organisation', description: 'Veuillez confirmer les bénévoles pour les Iftars.', date: '2026-02-15T14:00', lu: true },
  { id: '5', type: 'stock', titre: 'Chaises pliantes', description: 'Plus que 145 chaises disponibles. 55 réservées pour la distribution.', date: '2026-02-15T08:00', lu: true },
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
  { id: '4', salleId: '10', titre: 'Réunion Conseil', debut: '2026-02-18T20:00', fin: '2026-02-18T22:00', pole: 'Accueil' },
  { id: '5', salleId: '8', titre: 'Cours arabe adultes', debut: '2026-02-19T18:00', fin: '2026-02-19T20:00', pole: 'École (Avenir)' },
  { id: '6', salleId: '1', titre: 'Salat Joumou\'a', debut: '2026-02-20T12:00', fin: '2026-02-20T14:00', pole: 'Imam' },
  { id: '7', salleId: '12', titre: 'Iftar communautaire', debut: '2026-02-21T18:30', fin: '2026-02-21T21:00', pole: 'Social (ABD)', materiel: [{ materielId: '1', quantite: 100 }, { materielId: '6', quantite: 20 }] },
];

export const recoltesMock: Recolte[] = [
  { id: '1', date: '2026-02-14', montant: 3200, type: 'Joumou\'a', description: 'Collecte vendredi' },
  { id: '2', date: '2026-02-07', montant: 2850, type: 'Joumou\'a', description: 'Collecte vendredi' },
  { id: '3', date: '2026-02-10', montant: 15000, type: 'Campagne', description: 'Campagne Ramadan', pole: 'Récolte' },
  { id: '4', date: '2026-02-01', montant: 500, type: 'Don', description: 'Don anonyme' },
];

export const ticketsMock: TicketMaintenance[] = [
  { id: '1', titre: 'Fuite d\'eau - Toilettes RDC', description: 'Fuite au niveau du lavabo des toilettes hommes RDC.', localisation: 'RDC - Toilettes', priorite: 'haute', statut: 'ouvert', signalePar: 'Accueil', dateCreation: '2026-02-17T08:00' },
  { id: '2', titre: 'Ampoule grillée - Classe Coran 2', description: 'Deux néons ne fonctionnent plus dans la classe.', localisation: '1er Étage - Classe Coran 2', priorite: 'moyenne', statut: 'en_cours', signalePar: 'École (Avenir)', dateCreation: '2026-02-16T14:30' },
  { id: '3', titre: 'Climatisation en panne', description: 'La climatisation de la salle polyvalente ne démarre plus.', localisation: '2ème Étage - Salle Polyvalente', priorite: 'urgente', statut: 'ouvert', signalePar: 'Accueil', dateCreation: '2026-02-17T09:15' },
  { id: '4', titre: 'Porte coincée', description: 'La porte d\'accès au bureau Com ne se ferme plus correctement.', localisation: '3ème Étage - Bureau Com', priorite: 'basse', statut: 'résolu', signalePar: 'Com', dateCreation: '2026-02-14T11:00' },
  { id: '5', titre: 'Micro-ondes hors service', description: 'Le micro-ondes de la cuisine ne chauffe plus.', localisation: '2ème Étage - Cuisine', priorite: 'moyenne', statut: 'ouvert', signalePar: 'Social (ABD)', dateCreation: '2026-02-15T16:45' },
];

export const evenementsMock: Evenement[] = [
  {
    id: '1', titre: 'Conférence Ramadan', description: 'Grande conférence de préparation au Ramadan avec invité.', date: '2026-02-21',
    salleId: '1', budget: 2500, budgetDepense: 1800, pole: 'Imam',
    benevoles: [
      { nom: 'Ahmed B.', confirme: true }, { nom: 'Youssef K.', confirme: true },
      { nom: 'Fatima L.', confirme: false }, { nom: 'Omar S.', confirme: true },
    ],
    materiel: [{ materielId: '4', quantite: 2 }, { materielId: '5', quantite: 4 }],
  },
  {
    id: '2', titre: 'Distribution Alimentaire Mensuelle', description: 'Distribution de colis alimentaires pour les familles.', date: '2026-02-22',
    salleId: '8', budget: 1200, budgetDepense: 950, pole: 'Social (ABD)',
    benevoles: [
      { nom: 'Khadija M.', confirme: true }, { nom: 'Ibrahim D.', confirme: true },
      { nom: 'Sara T.', confirme: true }, { nom: 'Ali R.', confirme: false },
      { nom: 'Nour H.', confirme: false },
    ],
    materiel: [{ materielId: '1', quantite: 80 }, { materielId: '6', quantite: 15 }],
  },
  {
    id: '3', titre: 'Portes Ouvertes Mosquée', description: 'Journée portes ouvertes pour les voisins et institutions.', date: '2026-02-28',
    salleId: '12', budget: 800, budgetDepense: 200, pole: 'Com',
    benevoles: [
      { nom: 'Mehdi A.', confirme: true }, { nom: 'Leila B.', confirme: false },
    ],
    materiel: [{ materielId: '3', quantite: 2 }, { materielId: '5', quantite: 3 }],
  },
];

export const parkingPlacesMock: PlaceParking[] = Array.from({ length: 50 }, (_, i) => ({
  id: `p${i + 1}`,
  numero: i + 1,
  zone: (i < 18 ? 'A' : i < 34 ? 'B' : 'C') as 'A' | 'B' | 'C',
  occupee: Math.random() > 0.4,
}));

export const benevolesParkingMock: BenevoleParkingPoste[] = [
  { id: 'bp1', nom: 'Hassan M.', poste: 'Entrée principale', present: true },
  { id: 'bp2', nom: 'Rachid K.', poste: 'Entrée secondaire', present: false },
  { id: 'bp3', nom: 'Moussa D.', poste: 'Sortie', present: true },
  { id: 'bp4', nom: 'Bilal A.', poste: 'Guidage', present: true },
  { id: 'bp5', nom: 'Soufiane T.', poste: 'Guidage', present: false },
];
