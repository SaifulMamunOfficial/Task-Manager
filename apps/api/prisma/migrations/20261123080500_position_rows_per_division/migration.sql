-- A person can hold the same position in two divisions of the same unit (for example a member of two secretariats).
DROP INDEX "UserPosition_userId_unitId_positionId_key";
CREATE UNIQUE INDEX "UserPosition_userId_unitId_positionId_secretariatId_key" ON "UserPosition"("userId", "unitId", "positionId", "secretariatId");
